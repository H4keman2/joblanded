import { jsPDF } from "jspdf";

// A single-column layout modeled on the common Google Docs resume templates
// (see https://gdoc.io/resume-templates/): a bold colored header band for the
// name/contact line, accent-colored section headers with a rule underneath,
// and generous spacing so the hierarchy actually reads at a glance instead of
// blurring into one wall of 10pt text. Still no tables or multi-column
// tricks, so it stays readable by both humans and ATS parsers — matching the
// ATS-readability guidance the tailoring prompt itself gives (see
// DRAFT_SHAPE in jobs.functions.ts).
const MARGIN = 50;
const LINE_HEIGHT = 14.5;
const FONT = "helvetica";

// Matches the app's --primary brand teal (oklch(0.44 0.09 205) converted to sRGB).
const ACCENT: [number, number, number] = [0, 96, 106];
const TEXT: [number, number, number] = [31, 33, 36];
// Light tint of ACCENT, used for the contact/title lines reversed out of the header band.
const ACCENT_TINT: [number, number, number] = [214, 231, 231];

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 46) return false;
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

  const allLines = resumeText.replace(/\r\n/g, "\n").split("\n");

  // Pull the name (first non-blank line) and the short run of contact/title
  // lines that usually follows it, so they can be set apart in a header band
  // instead of blurring into the body copy like regular paragraph text.
  let i = 0;
  while (i < allLines.length && !allLines[i]!.trim()) i++;
  const nameLine = (allLines[i] ?? "").trim();
  i++;
  const metaLines: string[] = [];
  while (i < allLines.length && metaLines.length < 3) {
    const t = allLines[i]!.trim();
    if (!t) {
      i++;
      break;
    }
    if (isSectionHeader(t) || isBullet(t)) break;
    metaLines.push(t);
    i++;
  }
  const bodyLines = allLines.slice(i);

  // Header band (page 1 only): bold name + contact line reversed out of a
  // solid accent-color bar, the way most Google Docs resume templates open.
  const bandPadding = 20;
  const nameSize = 22;
  const metaSize = 10;
  const bandHeight =
    bandPadding * 2 + nameSize + (metaLines.length ? 6 + metaLines.length * 13 : 0);

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageWidth, bandHeight, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont(FONT, "bold");
  doc.setFontSize(nameSize);
  doc.text(nameLine, MARGIN, bandPadding + nameSize * 0.72);

  if (metaLines.length) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(metaSize);
    doc.setTextColor(...ACCENT_TINT);
    let metaY = bandPadding + nameSize * 0.72 + 20;
    for (const meta of metaLines) {
      doc.text(meta, MARGIN, metaY);
      metaY += 13;
    }
  }

  let y = bandHeight + 26;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setFont(FONT, "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT);

  for (const raw of bodyLines) {
    const line = raw.trim();

    if (!line) {
      y += LINE_HEIGHT * 0.5;
      continue;
    }

    if (isSectionHeader(line)) {
      y += 10;
      ensureSpace(LINE_HEIGHT + 10);
      doc.setFont(FONT, "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(...ACCENT);
      doc.text(line.toUpperCase(), MARGIN, y);
      y += 4;
      doc.setDrawColor(...ACCENT);
      doc.setLineWidth(1.2);
      doc.line(MARGIN, y, pageWidth - MARGIN, y);
      y += 14;
      doc.setFont(FONT, "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...TEXT);
      continue;
    }

    const bullet = isBullet(line);
    const indent = bullet ? 14 : 0;
    const wrapped = doc.splitTextToSize(bullet ? bullet.text : line, maxWidth - indent) as string[];

    wrapped.forEach((part, idx) => {
      ensureSpace(LINE_HEIGHT);
      if (bullet && idx === 0) {
        doc.setTextColor(...ACCENT);
        doc.text("•", MARGIN, y);
        doc.setTextColor(...TEXT);
      }
      doc.text(part, MARGIN + indent + (bullet ? 6 : 0), y);
      y += LINE_HEIGHT;
    });
  }

  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
