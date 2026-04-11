import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT    = join(__dirname, "../../scripts/parse_invoice.py");

/**
 * Pipe PDF buffer into parse_invoice.py (PyMuPDF) and return the
 * parsed fields object exactly as the Python script emits it.
 */
function runPythonParser(buffer) {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [SCRIPT]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => { stdout += chunk; });
    proc.stderr.on("data", (chunk) => { stderr += chunk; });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `Parser exited with code ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch {
        reject(new Error("Parser returned invalid JSON"));
      }
    });

    proc.on("error", (err) => reject(err));

    // Write PDF bytes to stdin then close the stream
    proc.stdin.write(buffer);
    proc.stdin.end();
  });
}

/**
 * Parse an uploaded invoice file.
 * @param {Buffer} buffer   Raw file bytes
 * @param {string} mimeType e.g. "application/pdf"
 * @returns {Promise<{ fields: Record<string, { value: string, confidence: number }>, gstVerification: object }>}
 */
export async function parseInvoice(buffer, mimeType) {
  if (mimeType === "application/pdf") {
    const result = await runPythonParser(buffer);
    return { fields: result.fields, gstVerification: result.gstVerification };
  }

  throw new Error("Only PDF uploads are supported for invoice parsing.");
}
