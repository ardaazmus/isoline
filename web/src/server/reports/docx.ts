/**
 * Release DOCX (plan 10 §4): headings, paragraphs with bound metric values, bullet lists, source notes, the GHG
 * table and the chart's data table — the same strings the CSV and SVG carry. A sign-off block and a disclosure
 * index close the document. Built on the server with the toolkit's `docx` package.
 */
import { BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { parse, render } from "./body";

const INK = "13233A";
const MUTED = "5F6E83";

export type DocxSection = { title: string; refs: string[]; body: string };
export type DocxInput = {
  title: string;
  subtitle: string;
  sections: DocxSection[];
  bound: Map<string, string>;
  tables: { ghg: { label: string; value: string }[] };
  labels: { refs: string; ghgTable: string; chart: string; chartNote: string; signoff: string; index: string; section: string; status: string; page: string; pageNote: string };
  signoff: { stage: string; name: string; at: string }[];
  index: { section: string; refs: string; status: string }[];
};

const border = { style: BorderStyle.SINGLE, size: 4, color: "D5DCE4" };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const cell = (text: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: text || "—", size: 19, bold })] })] });
const grid = (head: string[], rows: string[][]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 12, color: INK }, bottom: border, left: none, right: none, insideHorizontal: border, insideVertical: none },
    rows: [new TableRow({ tableHeader: true, children: head.map((h) => cell(h, true)) }), ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) }))],
  });

export async function releaseDocx(d: DocxInput): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: d.title, color: INK })] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: d.subtitle, color: MUTED, size: 22 })] }),
  ];
  d.sections.forEach((s, i) => {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, children: [new TextRun({ text: `${i + 1}. ${s.title}`, color: INK })] }));
    for (const b of parse(s.body)) {
      if (b.type === "h1" || b.type === "h2") children.push(new Paragraph({ heading: b.type === "h1" ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: [new TextRun({ text: render(b.text, d.bound), color: INK })] }));
      else if (b.type === "p") children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: render(b.text, d.bound), size: 21 })] }));
      else if (b.type === "ul") for (const item of b.items) children.push(new Paragraph({ indent: { left: 360 }, children: [new TextRun({ text: `• ${render(item, d.bound)}`, size: 21 })] }));
      else if (b.type === "source") children.push(new Paragraph({ children: [new TextRun({ text: render(b.text, d.bound), italics: true, size: 18, color: MUTED })] }));
      else if (b.type === "table") {
        children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: d.labels.ghgTable, bold: true, size: 19, color: INK })] }));
        children.push(grid(["", ""], d.tables.ghg.map((r) => [r.label, r.value])));
      } else if (b.type === "chart") {
        children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: d.labels.chart, bold: true, size: 19, color: INK })] }));
        children.push(grid(["", ""], d.tables.ghg.filter((r) => r.label).map((r) => [r.label, r.value])));
        children.push(new Paragraph({ children: [new TextRun({ text: d.labels.chartNote, italics: true, size: 17, color: MUTED })] }));
      }
    }
    if (s.refs.length) children.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: `${d.labels.refs}: `, bold: true, size: 17, color: MUTED }), new TextRun({ text: s.refs.join(" · "), size: 17, color: MUTED })] }));
  });
  if (d.signoff.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480 }, children: [new TextRun({ text: d.labels.signoff, color: INK })] }));
    children.push(grid(["", "", ""], d.signoff.map((x) => [x.stage, x.name, x.at])));
  }
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480 }, children: [new TextRun({ text: d.labels.index, color: INK })] }));
  children.push(grid([d.labels.section, d.labels.refs, d.labels.status, d.labels.page], d.index.map((x) => [x.section, x.refs, x.status, ""])));
  children.push(new Paragraph({ children: [new TextRun({ text: d.labels.pageNote, italics: true, size: 17, color: MUTED })] }));
  const doc = new Document({ creator: "Isoline", title: d.title, styles: { default: { document: { run: { font: "Calibri", color: INK } } } }, sections: [{ children }] });
  return new Uint8Array(await Packer.toBuffer(doc));
}
