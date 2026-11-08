/**
 * Debug script: builds the detailed PDF directly (bun run) and traces
 * every addPage() call with the current y position to locate the bug.
 */
process.env.DATABASE_URL = "file:../db/custom.db";
process.env.SESSION_SECRET = "debug";
process.env.MESS_PASSWORD_HASH =
  "pbkdf2_sha256$310000$wRuiOsnyZo/lInqyBQBtJA==$/sroquUSh3FBLcBxZw9tJklZUTj3K11GIvpwakPwPq8=";

import { buildPeriodReport } from "../src/lib/calc";
import { buildDetailedPdf } from "../src/lib/pdf/detailed";
import { todayStr, addDaysStr } from "../src/lib/format";

async function main() {
  const to = todayStr();
  const from = addDaysStr(to, -9); // 3 days -> small dataset
  console.log("period", from, to);
  const report = await buildPeriodReport("EAST", from, to);

  // Monkey-patch PDFKit addPage to trace calls
  const PDFDocument = (await import("pdfkit")).default;
  const proto = PDFDocument.prototype as unknown as { addPage: () => unknown; page: { height: number; margins: { top: number; bottom: number } } };
  const orig = proto.addPage;
  let calls = 0;
  (proto as unknown as { addPage: () => unknown }).addPage = function (...args: unknown[]) {
    calls++;
    const err = new Error("trace");
    const stack = (err.stack ?? "").split("\n").slice(2, 6).join(" | ");
    const p = (this as unknown as { page: { height: number; margins: { top: number; bottom: number } } | null }).page;
    const info = p ? `pageH=${p.height} top=${p.margins.top} bottom=${p.margins.bottom}` : "page=null(ctor)";
    console.log(`addPage #${calls}: y=${(this as unknown as { y: number }).y} ${info}\n    at ${stack}`);
    return orig.apply(this, args as []);
  };

  const buf = await buildDetailedPdf(report);
  console.log("PDF size:", buf.length, "bytes; addPage calls:", calls);
  await import("fs").then((fs) => fs.promises.writeFile("/tmp/pdftest/debug-detailed.pdf", buf));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
