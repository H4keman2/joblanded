export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // pdf.js hands back text runs in PDF content-stream order, which for a lot
    // of real-world PDFs (web resume builders exporting via a browser's
    // print-to-PDF engine, in particular) does NOT match visual reading order —
    // a two-column section can get emitted column-by-column instead of
    // row-by-row, and stray zero-width glyphs can land in the middle of a
    // word. Trusting that order (or the per-item hasEOL flag) is what used to
    // scramble the extracted text. Instead we reconstruct reading order from
    // each run's actual (x, y) position on the page.
    type Run = { str: string; x: number; y: number; endX: number; height: number };
    const runs: Run[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str) continue;
      const [, , c, d, e, f] = item.transform as number[];
      const height = Math.hypot(c, d) || item.height || 10;
      runs.push({ str: item.str, x: e, y: f, endX: e + (item.width ?? 0), height });
    }

    if (runs.length === 0) {
      pages.push("");
      continue;
    }

    // Group runs into visual lines by y-position, top to bottom. PDFs jitter a
    // point or two even within one visual line, so cluster with a tolerance
    // rather than requiring an exact match.
    const sortedByY = [...runs].sort((r1, r2) => r2.y - r1.y);
    const lines: Run[][] = [];
    for (const run of sortedByY) {
      const last = lines[lines.length - 1];
      const tolerance = Math.max(2, run.height * 0.4);
      if (last && Math.abs(last[0].y - run.y) <= tolerance) {
        last.push(run);
      } else {
        lines.push([run]);
      }
    }

    const lineTexts = lines.map((line) => {
      line.sort((r1, r2) => r1.x - r2.x);
      let text = "";
      let prevEndX: number | null = null;
      for (const run of line) {
        if (prevEndX !== null) {
          const gap = run.x - prevEndX;
          // A wide gap usually means two side-by-side pieces of information
          // (e.g. a date column next to a location column) — pad with extra
          // space so they don't visually fuse together instead of just one.
          if (gap > run.height * 2.5) text += "   ";
          else if (gap > run.height * 0.15) text += " ";
        }
        text += run.str;
        prevEndX = run.endX;
      }
      return text.replace(/\s+/g, " ").trim();
    });

    pages.push(lineTexts.filter(Boolean).join("\n"));
  }

  return pages.join("\n\n").trim();
}
