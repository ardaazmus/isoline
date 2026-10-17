/** Word (.docx) skeleton export for report templates and the annual-report checklist. */
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { SummaryRow } from "./summary";

const INK = "13233A";
const MUTED = "5F6E83";

export type DocSection = { title: string; guide: string; refs: string[]; figures: SummaryRow[]; status?: string };

function figureTable(rows: SummaryRow[]): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D5DCE4" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 12, color: INK }, bottom: border, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: border, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: r.label, size: 20 })] })] }),
            new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: r.value, size: 20, bold: true })] })] }),
          ],
        }),
    ),
  });
}

export async function buildDocx(opts: {
  title: string;
  subtitle: string;
  client: string;
  intro: string;
  sections: DocSection[];
  labels: { refs: string; figures: string; draft: string; sources: string };
  sources: string[];
}): Promise<Blob> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: opts.title, color: INK })] }),
    new Paragraph({ children: [new TextRun({ text: `${opts.client} · ${opts.subtitle}`, color: MUTED, size: 22 })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: opts.intro, italics: true, color: MUTED, size: 20 })] }),
  ];
  opts.sections.forEach((s, i) => {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, children: [new TextRun({ text: `${i + 1}. ${s.title}`, color: INK })] }));
    if (s.status) children.push(new Paragraph({ children: [new TextRun({ text: s.status, color: MUTED, size: 18 })] }));
    s.guide.split("\n").forEach((line) => children.push(new Paragraph({ children: [new TextRun({ text: line, size: 21 })] })));
    if (s.refs.length) children.push(new Paragraph({ children: [new TextRun({ text: `${opts.labels.refs}: `, bold: true, size: 18, color: MUTED }), new TextRun({ text: s.refs.join(" · "), size: 18, color: MUTED })] }));
    if (s.figures.length) {
      children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: opts.labels.figures, bold: true, size: 18, color: INK })] }));
      children.push(figureTable(s.figures));
    }
    children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: opts.labels.draft, color: "9A6412", size: 20 })] }));
  });
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 480 }, children: [new TextRun({ text: opts.labels.sources, color: INK })] }));
  opts.sources.forEach((s) => children.push(new Paragraph({ children: [new TextRun({ text: s, size: 18, color: MUTED })] })));
  const doc = new Document({
    creator: "Isoline",
    title: opts.title,
    styles: { default: { document: { run: { font: "Calibri", color: INK } } } },
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}
