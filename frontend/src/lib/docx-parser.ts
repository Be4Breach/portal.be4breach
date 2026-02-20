/**
 * Client-side DOCX pentest report parser.
 * Replicates the Python backend report_parser.py logic entirely in the browser
 * using JSZip to read the raw OOXML, so no file ever needs to be uploaded.
 *
 * Produces a PentestReport structure identical to what the backend returns.
 */

import JSZip from "jszip";
import type {
  PentestReport,
  PentestFinding,
  SeverityLevel,
} from "@/types/pentest-report";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: string[] = [
  "critical",
  "high",
  "medium",
  "low",
  "informational",
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0, 72%, 51%)",
  high: "hsl(25, 95%, 53%)",
  medium: "hsl(45, 93%, 47%)",
  low: "hsl(0, 0%, 64%)",
  informational: "hsl(210, 10%, 70%)",
};

// ─── XML helpers ──────────────────────────────────────────────────────────────

function innerText(el: Element): string {
  return Array.from(el.querySelectorAll("w\\:t, t"))
    .map((t) => t.textContent ?? "")
    .join("")
    .trim();
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

// ─── Engagement details ───────────────────────────────────────────────────────

function extractEngagement(paragraphs: Element[]): Record<string, string> {
  const text = paragraphs.map(innerText).join("\n");
  const engagement: Record<string, string> = {};

  const client = text.match(/Prepared For:\s*(.+)/i);
  if (client) engagement.client = client[1].trim();

  const date = text.match(/Report Date:\s*(\d{2}-\d{2}-\d{4})/i);
  if (date) engagement.reportDate = date[1].trim();

  const audit = text.match(/Type of Audit[:\s]*([A-Za-z ]+)/i);
  if (audit) engagement.auditType = audit[1].trim();

  return engagement;
}

// ─── Table parsing ────────────────────────────────────────────────────────────

interface RawTable {
  rows: string[][];
}

function extractTables(bodyEl: Element): RawTable[] {
  const tables: RawTable[] = [];
  for (const tbl of Array.from(bodyEl.querySelectorAll("w\\:tbl, tbl"))) {
    const rows: string[][] = [];
    for (const tr of Array.from(tbl.querySelectorAll("w\\:tr, tr"))) {
      const cells = Array.from(tr.querySelectorAll("w\\:tc, tc")).map(
        innerText,
      );
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push({ rows });
  }
  return tables;
}

// ─── Finding extraction ───────────────────────────────────────────────────────

function safeFloat(val: string): number | undefined {
  const m = val.match(/(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  return undefined;
}

function normalizeStatus(status?: string): string {
  if (!status) return "Unknown";
  const s = status.toLowerCase();
  if (s.includes("open") && !s.includes("closed")) return "Open";
  if (s.includes("progress") || s.includes("wip")) return "In Progress";
  if (s.includes("resolved") || s.includes("closed") || s.includes("fixed"))
    return "Resolved";
  if (s.includes("accepted")) return "Accepted";
  return status.trim();
}

function extractFindings(tables: RawTable[]): PentestFinding[] {
  const findings: Map<number, PentestFinding> = new Map();

  // 1) Summary table — header contains "observation" and "vulnerability"
  for (const tbl of tables) {
    if (!tbl.rows.length) continue;
    const header = tbl.rows[0].map((c) => c.toLowerCase());
    if (
      header.some(
        (h) =>
          (h.includes("observation") && h.includes("vulnerability")) ||
          h.includes("observation/ vulnerability"),
      )
    ) {
      for (let i = 1; i < tbl.rows.length; i++) {
        const cells = tbl.rows[i];
        if (cells.length < 6) continue;
        const idRaw = cells[0].replace(/\D/g, "");
        const fid = parseInt(idRaw, 10);
        if (isNaN(fid)) continue;

        const finding: PentestFinding = findings.get(fid) ?? { id: fid };
        if (cells[2]) finding.title = cells[2];
        if (cells[3]) finding.cwe = cells[3];
        const cvss = safeFloat(cells[4] ?? "");
        if (cvss !== undefined) finding.cvssScore = cvss;
        if (cells[5]) finding.severity = cells[5].trim() as SeverityLevel;
        findings.set(fid, finding);
      }
      break;
    }
  }

  // 2) Detail tables — first cell matches "<id>: <title>"
  for (const tbl of tables) {
    if (!tbl.rows.length) continue;
    const firstCell = tbl.rows[0][0] ?? "";
    const idMatch = firstCell.match(/^(\d+):\s*(.+)/);
    if (!idMatch) continue;

    const fid = parseInt(idMatch[1], 10);
    const title = idMatch[2].trim();
    const finding: PentestFinding = findings.get(fid) ?? { id: fid };
    if (title) finding.title = title;

    for (let i = 1; i < tbl.rows.length; i++) {
      const row = tbl.rows[i];
      if (row.length < 2) continue;
      const key = row[0].toLowerCase();
      const val = row[1].trim();

      if (key.includes("severity")) {
        finding.severity = val as SeverityLevel;
      } else if (key === "status") {
        finding.status = normalizeStatus(val);
      } else if (key.includes("cve") || key.includes("cwe")) {
        finding.cwe = val;
      } else if (key.includes("cvss")) {
        const cv = safeFloat(val);
        if (
          cv !== undefined &&
          (finding.cvssScore === undefined || cv > finding.cvssScore)
        )
          finding.cvssScore = cv;
      } else if (key.includes("description")) {
        finding.description = val || (tbl.rows[i + 1]?.[0] ?? "");
      } else if (key.startsWith("impact")) {
        finding.impact = val || (tbl.rows[i + 1]?.[0] ?? "");
      } else if (key.includes("affected asset")) {
        finding.affectedAsset = val || (tbl.rows[i + 1]?.[0] ?? "");
      } else if (key.includes("recommendation")) {
        finding.recommendations = val || (tbl.rows[i + 1]?.[0] ?? "");
      } else if (key.includes("reference")) {
        finding.references = val || (tbl.rows[i + 1]?.[0] ?? "");
      } else if (key.includes("proof of concept")) {
        finding.poc = val || (tbl.rows[i + 1]?.[0] ?? "");
      }
    }

    findings.set(fid, finding);
  }

  return Array.from(findings.values());
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function buildSummary(findings: PentestFinding[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const f of findings) {
    const sev = (f.severity ?? "").toLowerCase();
    if (SEVERITY_ORDER.includes(sev)) {
      summary[sev] = (summary[sev] ?? 0) + 1;
    }
  }
  return summary;
}

// ─── Dashboard builder ────────────────────────────────────────────────────────

function buildDashboard(
  findings: PentestFinding[],
  summary: Record<string, number>,
  engagement: Record<string, string>,
): PentestReport {
  const severityChart = SEVERITY_ORDER.map((level) => ({
    name: level.charAt(0).toUpperCase() + level.slice(1),
    value: summary[level] ?? 0,
    color: SEVERITY_COLORS[level],
  }));

  const statusCounts: Record<string, number> = {};
  for (const f of findings) {
    const s = normalizeStatus(f.status);
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }
  const statusBreakdown = Object.entries(statusCounts).map(
    ([status, count]) => ({
      status,
      count,
    }),
  );

  const scores = findings
    .map((f) => f.cvssScore)
    .filter((s): s is number => s !== undefined);

  const cvss =
    scores.length > 0
      ? {
          average: parseFloat(
            (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
          ),
          max: Math.max(...scores),
          min: Math.min(...scores),
          count: scores.length,
        }
      : null;

  const sorted = [...findings].sort((a, b) => {
    const ai = SEVERITY_ORDER.indexOf((a.severity ?? "").toLowerCase());
    const bi = SEVERITY_ORDER.indexOf((b.severity ?? "").toLowerCase());
    const aIdx = ai === -1 ? SEVERITY_ORDER.length : ai;
    const bIdx = bi === -1 ? SEVERITY_ORDER.length : bi;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return (b.cvssScore ?? 0) - (a.cvssScore ?? 0);
  });

  return {
    engagement,
    summary,
    totalFindings: findings.length,
    findings,
    severityChart,
    statusBreakdown,
    cvss,
    topFindings: sorted.slice(0, 5),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function parseDocxFile(file: File): Promise<PentestReport> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml)
    throw new Error("Invalid DOCX: cannot find word/document.xml");

  const doc = parseXml(documentXml);
  const body = doc.querySelector("w\\:body, body");
  if (!body) throw new Error("Invalid DOCX: no body element found");

  const paragraphs = Array.from(body.querySelectorAll("w\\:p, p"));
  const engagement = extractEngagement(paragraphs);
  const tables = extractTables(body);
  const findings = extractFindings(tables);
  const summary = buildSummary(findings);

  return buildDashboard(findings, summary, engagement);
}
