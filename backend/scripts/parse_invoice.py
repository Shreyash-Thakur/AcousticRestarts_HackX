#!/usr/bin/env python3
"""
Invoice parser for InvoFlow — digital-born PDFs in the standard Business Invoice format.

Expected PDF structure (PyMuPDF text extraction):
  Line 0:  <SME company name>          e.g. "Aarya Tech Solutions Pvt Ltd"
  Line 1:  "Business Invoice"
  Line 2+: alternating label / value pairs from the table:
              "Invoice Number:"      "INV-1000"
              "Invoice Date:"        "03-04-2026"
              "Due Date:"            "31-05-2026"
              "Client Name:"         "Reliance Retail Ltd"
              "Client GST:"          "14BTBIW1440B2Z1"
              "Total Amount (INR):"  "I319,124"  (rupee glyph → 'I')

After extraction the GST database is cross-referenced:
  - Company name found & GST matches   → confidence 0.99, gstVerification "verified"
  - Company name found & GST mismatch  → confidence 0.25, gstVerification "mismatch"
  - GST found   & company matches      → confidence 0.99, gstVerification "verified"
  - GST found   & company mismatch     → confidence 0.25, gstVerification "mismatch"
  - Neither found in DB                → confidence unchanged, gstVerification "unknown"

Reads the PDF from stdin as raw bytes, writes JSON to stdout.
"""

import sys
import json
import re
import os
import fitz  # PyMuPDF


# ── GST database ──────────────────────────────────────────────────────
_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "gst_database.json")

def load_gst_db() -> list[dict]:
    try:
        with open(_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

# Build two lookup dicts at import time
_GST_DB   = load_gst_db()
_BY_NAME  = {e["companyName"].strip().lower(): e for e in _GST_DB}
_BY_GST   = {e["gst"].strip().upper(): e        for e in _GST_DB}


# ── Date normalisation ────────────────────────────────────────────────
def normalise_date(raw: str) -> str:
    """dd-mm-yyyy  →  yyyy-mm-dd"""
    raw = raw.strip()
    m = re.match(r'^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$', raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    return raw


# ── Amount cleaning ───────────────────────────────────────────────────
def clean_amount(raw: str) -> str:
    """Strip rupee glyph (renders as 'I' or '■' or '₹'), commas, spaces."""
    cleaned = re.sub(r'^[^\d]+', '', raw.strip())
    return cleaned.replace(',', '').strip()


# ── Label → field mapping ─────────────────────────────────────────────
LABEL_MAP = {
    "invoice number":      ("invoiceNumber",     0.97),
    "invoice date":        ("invoiceDate",       0.97),
    "due date":            ("dueDate",           0.97),
    "client name":         ("clientCompanyName", 0.97),
    "client gst":          ("clientGSTNumber",   0.97),
    "total amount (inr)":  ("totalAmount",       0.97),
    "total amount":        ("totalAmount",       0.93),
}

DATE_FIELDS   = {"invoiceDate", "dueDate"}
AMOUNT_FIELDS = {"totalAmount"}


def empty_fields() -> dict:
    keys = ["smeName", "invoiceNumber", "invoiceDate", "dueDate",
            "clientCompanyName", "clientGSTNumber", "totalAmount"]
    return {k: {"value": "", "confidence": 0.1} for k in keys}


# ── GST cross-reference ───────────────────────────────────────────────
def verify_gst(fields: dict) -> dict:
    """
    Cross-reference clientCompanyName and clientGSTNumber against the
    GST database.  Mutates and returns fields with adjusted confidence
    and a top-level gstVerification object.
    """
    company = fields["clientCompanyName"]["value"].strip().lower()
    gst     = fields["clientGSTNumber"]["value"].strip().upper()

    if not company and not gst:
        return {"status": "unknown", "message": "No client name or GST extracted"}

    db_by_name = _BY_NAME.get(company)
    db_by_gst  = _BY_GST.get(gst)

    # ── Case 1: company name is in DB ────────────────────────────────
    if db_by_name:
        expected_gst = db_by_name["gst"].upper()
        if gst == expected_gst:
            fields["clientGSTNumber"]["confidence"] = 0.99
            fields["clientCompanyName"]["confidence"] = 0.99
            return {
                "status": "verified",
                "message": f"GST {gst} correctly matches {db_by_name['companyName']}",
            }
        else:
            fields["clientGSTNumber"]["confidence"] = 0.25
            return {
                "status": "mismatch",
                "message": (
                    f"GST mismatch: '{db_by_name['companyName']}' "
                    f"should have GST {expected_gst}, got {gst or '(none)'}"
                ),
                "expectedGST": expected_gst,
            }

    # ── Case 2: GST number is in DB (company name not found by name) ─
    if db_by_gst:
        expected_name = db_by_gst["companyName"]
        # Loose match — strip common suffixes for comparison
        def normalise_name(n):
            return re.sub(r'\b(pvt|ltd|llp|inc|corp|limited|private)\b', '', n.lower()).strip()

        if normalise_name(company) == normalise_name(expected_name.lower()):
            fields["clientGSTNumber"]["confidence"] = 0.99
            fields["clientCompanyName"]["confidence"] = 0.99
            return {
                "status": "verified",
                "message": f"GST {gst} correctly matches {expected_name}",
            }
        else:
            fields["clientCompanyName"]["confidence"] = 0.25
            return {
                "status": "mismatch",
                "message": (
                    f"Name mismatch: GST {gst} belongs to '{expected_name}', "
                    f"but invoice says '{fields['clientCompanyName']['value']}'"
                ),
                "expectedName": expected_name,
            }

    # ── Case 3: neither found ────────────────────────────────────────
    return {
        "status": "unknown",
        "message": "Company and GST not found in local database — manual verification required",
    }


# ── Main parser ───────────────────────────────────────────────────────
def parse(pdf_bytes: bytes) -> tuple[dict, dict]:
    doc   = fitz.open(stream=pdf_bytes, filetype="pdf")
    lines = []
    for page in doc:
        lines += [l.strip() for l in page.get_text().splitlines() if l.strip()]
    doc.close()

    fields = empty_fields()

    # SME name: first line of the document
    if lines:
        fields["smeName"] = {"value": lines[0], "confidence": 0.95}

    # Table rows: alternating label / value lines
    i = 0
    while i < len(lines):
        line       = lines[i]
        normalised = line.rstrip(":").strip().lower()

        if normalised in LABEL_MAP and i + 1 < len(lines):
            field_key, conf = LABEL_MAP[normalised]
            value = lines[i + 1].strip()

            if field_key in DATE_FIELDS:
                value = normalise_date(value)
            elif field_key in AMOUNT_FIELDS:
                value = clean_amount(value)

            if value:
                fields[field_key] = {"value": value, "confidence": conf}
            i += 2
            continue

        i += 1

    gst_verification = verify_gst(fields)
    return fields, gst_verification


if __name__ == "__main__":
    try:
        pdf_bytes        = sys.stdin.buffer.read()
        fields, gst_ver  = parse(pdf_bytes)
        print(json.dumps({"fields": fields, "gstVerification": gst_ver}))
    except Exception as exc:
        sys.stderr.write(str(exc) + "\n")
        sys.exit(1)
