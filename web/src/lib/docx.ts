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

/** Sign-off block: who prepared and approved each data section the document uses (workflow step 4). */
export type DocApproval = {
  labels: { title: string; section: string; status: string; preparedBy: string; approvedBy: string; date: string };
  rows: { section: string; status: string; preparedBy: string; approvedBy: string; date: string }[];
  /** Printed in bold under the title when any section used is not approved. */
  draftNote?: string;
};

function approvalTable(a: DocApproval): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D5DCE4" };
  const cell = (text: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: text || "—", size: 18, bold })] })] });
  const l = a.labels;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 12, color: INK }, bottom: border, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: border, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
    rows: [
      new TableRow({ tableHeader: true, children: [l.section, l.status, l.preparedBy, l.approvedBy, l.date].map((h) => cell(h, true)) }),
      ...a.rows.map((r) => new TableRow({ children: [r.section, r.status, r.preparedBy, r.approvedBy, r.date].map((v) => cell(v)) })),
    ],
  });
}

export type DocIndex = {
  title: string;
  labels: { section: string; refs: string; figures: string };
  rows: { section: string; refs: string; figures: string }[];
};

function indexTable(idx: DocIndex): Table {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D5DCE4" };
  const cell = (text: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: text || "—", size: 18, bold })] })] });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 12, color: INK }, bottom: border, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: border, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
    rows: [
      new TableRow({ tableHeader: true, children: [idx.labels.section, idx.labels.refs, idx.labels.figures].map((h) => cell(h, true)) }),
      ...idx.rows.map((r) => new TableRow({ children: [r.section, r.refs, r.figures].map((v) => cell(v)) })),
    ],
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
  approval?: DocApproval;
  contentIndex?: DocIndex;
}): Promise<Blob> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: opts.title, color: INK })] }),
    new Paragraph({ children: [new TextRun({ text: `${opts.client} · ${opts.subtitle}`, color: MUTED, size: 22 })] }),
  ];
  if (opts.approval?.draftNote) children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: opts.approval.draftNote, bold: true, color: "B4232A", size: 22 })] }));
  children.push(new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: opts.intro, italics: true, color: MUTED, size: 20 })] }));
  if (opts.approval && opts.approval.rows.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: opts.approval.labels.title, color: INK })] }));
    children.push(approvalTable(opts.approval));
  }
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
  if (opts.contentIndex && opts.contentIndex.rows.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480 }, children: [new TextRun({ text: opts.contentIndex.title, color: INK })] }));
    children.push(indexTable(opts.contentIndex));
  }
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
