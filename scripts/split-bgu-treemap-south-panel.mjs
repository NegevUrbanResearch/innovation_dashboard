/**
 * Splits each aggregate row with residence_panel "Lives outside BS" into two rows:
 *   - "South" — southern Israel / Negev residence (approximate share for visualization & palette QA)
 *   - "Lives outside BS" — remainder (rest of Israel & abroad in this extract)
 *
 * Replace upstream ETL when real south/negev counts exist; until then this keeps totals
 * row-wise (south_n + outside_n === original n) so treemap sums stay consistent.
 *
 * Usage (repo root):
 *   node scripts/split-bgu-treemap-south-panel.mjs
 * Optional: SOUTH_SHARE=0.29 node scripts/split-bgu-treemap-south-panel.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public", "linkedin-data", "bgu_treemap_drilldown_agg.csv");

const PANEL_OUTSIDE = "Lives outside BS";
const PANEL_SOUTH = "South";
const DEFAULT_SHARE = 0.34;

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function formatCsvField(f) {
  const s = String(f);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatCsvLine(fields) {
  return fields.map(formatCsvField).join(",");
}

const share = Number(process.env.SOUTH_SHARE ?? DEFAULT_SHARE);
if (!Number.isFinite(share) || share <= 0 || share >= 1) {
  console.error("SOUTH_SHARE must be in (0, 1)");
  process.exit(1);
}

const raw = fs.readFileSync(SRC, "utf8");
if (raw.includes("\nSouth,") || raw.startsWith("South,")) {
  console.error(
    "This CSV already has South panel rows. Restore bgu_treemap_drilldown_agg.csv from git before re-running.",
  );
  process.exit(1);
}
const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const lines = text.split("\n").filter((l) => l.length > 0);

let sumIn = 0;
let sumOut = 0;
const outLines = [lines[0]];

for (let li = 1; li < lines.length; li++) {
  const cells = parseCsvLine(lines[li]);
  if (cells.length < 6) continue;
  const [panel, bucket, segment, employer, education, nStr] = [
    cells[0],
    cells[1],
    cells[2],
    cells[3],
    cells[4],
    cells[cells.length - 1],
  ];
  const n = Math.round(Number(nStr));
  if (!Number.isFinite(n) || n <= 0) continue;
  sumIn += n;

  if (panel !== PANEL_OUTSIDE) {
    sumOut += n;
    outLines.push(lines[li]);
    continue;
  }

  const southN = Math.round(n * share);
  const outsideN = n - southN;
  const base = [bucket, segment, employer, education];

  if (southN > 0) {
    sumOut += southN;
    outLines.push(formatCsvLine([PANEL_SOUTH, ...base, southN]));
  }
  if (outsideN > 0) {
    sumOut += outsideN;
    outLines.push(formatCsvLine([PANEL_OUTSIDE, ...base, outsideN]));
  }
}

if (sumIn !== sumOut) {
  console.error("Sum mismatch", { sumIn, sumOut });
  process.exit(1);
}

fs.writeFileSync(SRC, outLines.join("\n") + "\n", "utf8");
console.log("OK", {
  path: SRC,
  rowsWritten: outLines.length - 1,
  totalN: sumOut,
  southShare: share,
});
