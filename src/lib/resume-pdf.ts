import { jsPDF } from "jspdf";

// A deliberately plain, single-column layout: bold name, underlined section
// headers, simple bullets, body text. No tables or multi-column tricks, so it
// stays readable by both humans and ATS parsers — matching the ATS-readability
// guidance the tailoring prompt itself gives (see DRAFT_SHAPE in jobs.functions.ts).
const MARGIN = 54; // 0.75in at 72pt/in
const LINE_HEIGHT = 14;
const FONT = "helvetica";

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 42) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  return letters.length > 1 && letters === letters.toUpperCase();
}

function isBullet(line: string): { text: string } | null {
  const m = line.match(/^\s*[-•*]\s+(.*)$/);
  return m ? { text: m[1] ?? "" } : null;
}

export function downloadResumePdf(resumeText: string, fileName: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;

  let y = MARGIN;
  let sawNameLine = false;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const lines = resumeText.replace(/\r\n/g, "\n").split("\n");

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      y += LINE_HEIGHT * 0.5;
      continue;
    }

    // Treat the first non-blank line as the candidate's name/header line.
    if (!sawNameLine) {
      sawNameLine = true;
      ensureSpace(24);
      doc.setFont(FONT, "bold");
      doc.setFontSize(17);
      doc.text(line, MARGIN, y);
      y += 22;
      doc.setFont(FONT, "normal");
      doc.setFontSize(10);
      continue;
    }

    if (isSectionHeader(line)) {
      y += 8;
      ensureSpace(LINE_HEIGHT + 6);
      doc.setFont(FONT, "bold");
      doc.setFontSize(11);
      doc.text(line.toUpperCase(), MARGIN, y);
      y += 3;
      doc.setDrawColor(160);
      doc.line(MARGIN, y, pageWidth - MARGIN, y);
      y += 12;
      doc.setFont(FONT, "normal");
      doc.setFontSize(10);
      continue;
    }

    const bullet = isBullet(line);
    const indent = bullet ? 14 : 0;
    const wrapped = doc.splitTextToSize(bullet ? bullet.text : line, maxWidth - indent) as string[];

    wrapped.forEach((part, i) => {
      ensureSpace(LINE_HEIGHT);
      const prefix = bullet && i === 0 ? "•  " : bullet ? "    " : "";
      doc.text(`${prefix}${part}`, MARGIN + indent, y);
      y += LINE_HEIGHT;
    });
  }

  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
