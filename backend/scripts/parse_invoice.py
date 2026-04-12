#!/usr/bin/env python3
"""
Invoice parser for InvoFlow — supports two PDF layouts.

Format v1  "Business Invoice"
  Line 0:  <SME name>
  Line 1:  "Business Invoice"
  Then alternating label / value lines:
    "Invoice Number:"      "INV-1000"
    "Invoice Date:"        "03-04-2026"
    "Due Date:"            "31-05-2026"
    "Client Name:"         "Reliance Retail Ltd"
    "Client GST:"          "14BTBIW1440B2Z1"
    "Total Amount (INR):"  "I319,124"   (rupee glyph → 'I')

Format v2  "Modern Invoice"
  Header:      <SME name>               HexaLoop Innovations
  Keyword:     INVOICE
  Bill-to:     BILL TO:
               <Client name>            MetroBuild Infra
               GST: <gst>              GST: 21FUKTY8063O5ZI
  Inline rows: "Invoice Number: INV-2017"
               "Invoice Date:   22-04-2026"
               "Due Date:       22-05-2026"
  Total:       "Grand Total: $11 USD"

Both formats are cross-referenced against gst_database.json.
PDF bytes arrive on stdin; JSON result is written to stdout.
"""

import sys
import json
import re
import os
import fitz  # PyMuPDF


# ── GST database ──────────────────────────────────────────────────────
_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "gst_database.json")


def _load_gst_db():
    try:
        with open(_DB_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []


_GST_DB  = _load_gst_db()
_BY_NAME = {e["companyName"].strip().lower(): e for e in _GST_DB}
_BY_GST  = {e["gst"].strip().upper():         e for e in _GST_DB}


# ── Helpers ───────────────────────────────────────────────────────────

def normalise_date(raw: str) -> str:
    """dd-mm-yyyy  (or . or /)  →  yyyy-mm-dd"""
    raw = raw.strip()
    m = re.match(r'^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$', raw)
    if m:
        d, mo, y = m.groups()
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    return raw


def clean_amount(raw: str) -> str:
    """Strip any leading currency glyph (₹ I $ £), trailing currency code, commas."""
    s = re.sub(r'^[^\d]+', '', raw.strip())        # drop leading non-digits
    s = re.sub(r'\s*(USD|INR|usd|inr)\b.*$', '', s) # drop trailing " USD" etc.
    return s.replace(',', '').strip()


DATE_FIELDS   = {"invoiceDate", "dueDate"}
AMOUNT_FIELDS = {"totalAmount"}


def _empty_fields() -> dict:
    keys = ["smeName", "invoiceNumber", "invoiceDate", "dueDate",
            "clientCompanyName", "clientGSTNumber", "totalAmount"]
    return {k: {"value": "", "confidence": 0.1} for k in keys}


# ── Extraction patterns ───────────────────────────────────────────────

# v2 — inline "Label: Value" on a single line (tried via regex over full text)
_INLINE = [
    ("invoiceNumber",   r'Invoice\s+Number:?\s*([A-Z0-9][A-Z0-9\-]+)',          0.97),
    ("invoiceDate",     r'Invoice\s+Date:?\s*(\d{1,2}[-./]\d{1,2}[-./]\d{4})', 0.97),
    ("dueDate",         r'Due\s+Date:?\s*(\d{1,2}[-./]\d{1,2}[-./]\d{4})',     0.97),
    # Grand Total first (v2), then Total Amount fallback (v1 / generic)
    ("totalAmount",     r'Grand\s+Total:?\s*\$?([\d,]+(?:\.\d+)?)',             0.95),
    ("totalAmount",     r'Total\s+Amount[^:\n]*:?\s*[I₹$£]?([\d,]+(?:\.\d+)?)', 0.93),
    # GST number: 15-char alphanumeric after "GST:"
    ("clientGSTNumber", r'\bGST:?\s*([0-9A-Z]{15})\b',                          0.97),
]

# v1 — alternating label / value lines (label on line i, value on line i+1)
_V1_LABELS = {
    "invoice number":      ("invoiceNumber",     0.97),
    "invoice date":        ("invoiceDate",       0.97),
    "due date":            ("dueDate",           0.97),
    "client name":         ("clientCompanyName", 0.97),
    "client gst":          ("clientGSTNumber",   0.97),
    "total amount (inr)":  ("totalAmount",       0.97),
    "total amount":        ("totalAmount",       0.93),
    "grand total":         ("totalAmount",       0.95),
}

# Lines that are definitely not a company name
_NOT_COMPANY = re.compile(
    r'^(?:INVOICE|BILL\s+TO:?|DESCRIPTION|AMOUNT|GST:?|'
    r'INV-\d+|\d{1,2}[-./]\d{1,2}[-./]\d{4})$',
    re.IGNORECASE,
)
_FIELD_KEYWORD = re.compile(
    r'invoice\s+(?:number|date)|due\s+date|grand\s+total|total\s+amount|'
    r'bill\s+to|description|amount\b',
    re.IGNORECASE,
)


# ── Core extractor ────────────────────────────────────────────────────

def _extract(lines: list[str]) -> dict:
    fields    = _empty_fields()
    full_text = "\n".join(lines)

    # ── SME name ──────────────────────────────────────────────────────
    # Scan the first 15 lines for a line that looks like a company header
    # (not a keyword, not a known field marker, not empty).
    for line in lines[:15]:
        s = line.strip()
        if s and not _NOT_COMPANY.match(s) and not _FIELD_KEYWORD.search(s):
            fields["smeName"] = {"value": s, "confidence": 0.92}
            break

    # ── Inline regex pass (handles v2 and any hybrid layout) ──────────
    for field_key, pattern, conf in _INLINE:
        if fields[field_key]["value"]:
            continue                        # already found by an earlier pattern
        m = re.search(pattern, full_text, re.IGNORECASE)
        if not m:
            continue
        value = m.group(1).strip()
        if field_key in DATE_FIELDS:
            value = normalise_date(value)
        elif field_key in AMOUNT_FIELDS:
            value = clean_amount(value)
        if value:
            fields[field_key] = {"value": value, "confidence": conf}

    # ── Client company name ───────────────────────────────────────────
    # v2: first non-GST line after "BILL TO:"
    if not fields["clientCompanyName"]["value"]:
        for i, line in enumerate(lines):
            if re.fullmatch(r'BILL\s+TO:?', line.strip(), re.IGNORECASE):
                for candidate in lines[i + 1:]:
                    c = candidate.strip()
                    if c and not re.match(r'GST:', c, re.IGNORECASE):
                        fields["clientCompanyName"] = {"value": c, "confidence": 0.95}
                        break
                break

    # ── Alternating-line pass (v1 fallback for any field still missing) ─
    for i, line in enumerate(lines):
        norm = line.rstrip(":").strip().lower()
        if norm not in _V1_LABELS:
            continue
        field_key, conf = _V1_LABELS[norm]
        if fields[field_key]["value"]:
            continue                        # already found
        if i + 1 >= len(lines):
            continue
        value = lines[i + 1].strip()
        if field_key in DATE_FIELDS:
            value = normalise_date(value)
        elif field_key in AMOUNT_FIELDS:
            value = clean_amount(value)
        if value:
            fields[field_key] = {"value": value, "confidence": conf}

    return fields


# ── GST cross-reference ───────────────────────────────────────────────

def _verify_gst(fields: dict) -> dict:
    company = fields["clientCompanyName"]["value"].strip().lower()
    gst     = fields["clientGSTNumber"]["value"].strip().upper()

    if not company and not gst:
        return {"status": "unknown", "message": "No client name or GST extracted"}

    db_by_name = _BY_NAME.get(company)
    db_by_gst  = _BY_GST.get(gst)

    if db_by_name:
        expected_gst = db_by_name["gst"].upper()
        if gst == expected_gst:
            fields["clientGSTNumber"]["confidence"]   = 0.99
            fields["clientCompanyName"]["confidence"] = 0.99
            return {
                "status":  "verified",
                "message": f"GST {gst} correctly matches {db_by_name['companyName']}",
            }
        else:
            fields["clientGSTNumber"]["confidence"] = 0.25
            return {
                "status":      "mismatch",
                "message":     (f"GST mismatch: '{db_by_name['companyName']}' "
                                f"should have GST {expected_gst}, got {gst or '(none)'}"),
                "expectedGST": expected_gst,
            }

    if db_by_gst:
        expected_name = db_by_gst["companyName"]

        def _norm(n):
            return re.sub(r'\b(pvt|ltd|llp|inc|corp|limited|private)\b', '',
                          n.lower()).strip()

        if _norm(company) == _norm(expected_name.lower()):
            fields["clientGSTNumber"]["confidence"]   = 0.99
            fields["clientCompanyName"]["confidence"] = 0.99
            return {
                "status":  "verified",
                "message": f"GST {gst} correctly matches {expected_name}",
            }
        else:
            fields["clientCompanyName"]["confidence"] = 0.25
            return {
                "status":       "mismatch",
                "message":      (f"Name mismatch: GST {gst} belongs to '{expected_name}', "
                                 f"but invoice says "
                                 f"'{fields['clientCompanyName']['value']}'"),
                "expectedName": expected_name,
            }

    return {
        "status":  "unknown",
        "message": "Company and GST not found in local database — manual verification required",
    }


# ── Entry point ───────────────────────────────────────────────────────

def _sme_from_blocks(page) -> str:
    """
    Find the SME name by picking the topmost-leftmost text block on the page
    that isn't the word 'INVOICE'.  Works regardless of the order PyMuPDF
    returns lines in get_text(), which can differ from visual reading order
    in two-column layouts.
    """
    blocks = page.get_text("blocks")           # (x0,y0,x1,y1, text, blk, type)
    candidates = []
    for b in blocks:
        if b[6] != 0:                          # skip image blocks
            continue
        first_line = b[4].strip().splitlines()[0].strip() if b[4].strip() else ""
        if not first_line:
            continue
        if re.fullmatch(r'INVOICE', first_line, re.IGNORECASE):
            continue
        candidates.append((b[1], b[0], first_line))   # (y0, x0, text)
    if not candidates:
        return ""
    candidates.sort()                          # sort by y0, then x0
    return candidates[0][2]


def parse(pdf_bytes: bytes) -> tuple:
    doc   = fitz.open(stream=pdf_bytes, filetype="pdf")
    lines = []
    sme_from_blocks = ""
    for page in doc:
        if not sme_from_blocks:
            sme_from_blocks = _sme_from_blocks(page)
        lines += [ln.strip() for ln in page.get_text().splitlines() if ln.strip()]
    doc.close()

    fields           = _extract(lines)
    gst_verification = _verify_gst(fields)

    # Override smeName with the block-position result when available —
    # this is more reliable than scanning lines in extraction order.
    if sme_from_blocks:
        fields["smeName"] = {"value": sme_from_blocks, "confidence": 0.95}

    return fields, gst_verification


if __name__ == "__main__":
    try:
        pdf_bytes       = sys.stdin.buffer.read()
        fields, gst_ver = parse(pdf_bytes)
        print(json.dumps({"fields": fields, "gstVerification": gst_ver}))
    except Exception as exc:
        sys.stderr.write(str(exc) + "\n")
        sys.exit(1)
