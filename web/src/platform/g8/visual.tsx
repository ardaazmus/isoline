/**
 * G8-04/05 diagrams as plain SVG (no WebGL, nothing loaded until the page needs it): every shape has a text label,
 * status is never colour alone, motion stops under prefers-reduced-motion, and a data table carries the same
 * numbers for screen readers and for copying.
 */
import type { Block, SankeyLink, SankeyNode } from "@/lib/visual/layout";

const MOTION = `.iso-block{transition:transform .45s ease}.iso-block:hover{transform:translateY(-4px)}.flow-link{transition:opacity .35s ease}.flow-link:hover{opacity:.55}@media (prefers-reduced-motion: reduce){.iso-block,.flow-link{transition:none}.iso-block:hover{transform:none}}`;

export function SiteMap({ blocks, width, height, title, desc, labels }: { blocks: Block[]; width: number; height: number; title: string; desc: string; labels: { done: (a: number, n: number) => string; returned: (n: number) => string } }) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-labelledby="sitemap-t sitemap-d" className="max-h-[520px]">
      <title id="sitemap-t">{title}</title>
      <desc id="sitemap-d">{desc}</desc>
      <style>{MOTION}</style>
      {blocks.map((b) => {
        const shade = b.progress >= 1 ? "#2F4FE0" : b.progress >= 0.5 ? "#5C76EA" : "#9AAAF2";
        return (
          <g key={b.id} className="iso-block">
            <polygon points={b.left} fill="#C9D2F7" stroke="#13233A" strokeWidth={0.6} />
            <polygon points={b.right} fill="#AEBBF3" stroke="#13233A" strokeWidth={0.6} />
            <polygon points={b.top} fill={shade} stroke={b.blockers ? "#B4232A" : "#13233A"} strokeWidth={b.blockers ? 2.4 : 0.6} strokeDasharray={b.blockers ? "5 3" : undefined} />
            <text x={b.labelX} y={b.labelY} textAnchor="middle" fontSize={13} fontWeight={600} fill="#13233A" stroke="#FFFFFF" strokeWidth={4} paintOrder="stroke">
              {b.name}
            </text>
            <text x={b.labelX} y={b.labelY + 16} textAnchor="middle" fontSize={11.5} fill="#3A4A63" stroke="#FFFFFF" strokeWidth={4} paintOrder="stroke">
              {labels.done(b.accepted, b.total)}
              {b.blockers ? ` · ${labels.returned(b.blockers)}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function FlowSankey({ nodes, links, width, height, title, format }: { nodes: SankeyNode[]; links: SankeyLink[]; width: number; height: number; title: string; format: (v: number) => string }) {
  const PAD_X = 150;
  return (
    <svg viewBox={`${-PAD_X} -10 ${width + PAD_X * 2} ${height + 20}`} width="100%" role="img" aria-labelledby="flow-t" className="max-h-[460px]">
      <title id="flow-t">{title}</title>
      <style>{MOTION}</style>
      {links.map((l, i) => (
        <path key={i} d={l.path} className="flow-link" fill="#2F4FE0" fillOpacity={0.22} stroke="#2F4FE0" strokeOpacity={0.35} strokeWidth={0.5}>
          <title>{`${l.source} → ${l.target}: ${format(l.value)}`}</title>
        </path>
      ))}
      {nodes.map((n) => {
        const left = n.column === 0;
        return (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={14} height={n.h} rx={3} fill="#13233A" />
            <text x={left ? n.x - 8 : n.x + 22} y={n.y + n.h / 2} dominantBaseline="middle" textAnchor={left ? "end" : "start"} fontSize={12.5} fill="#13233A">
              <tspan fontWeight={600}>{n.id}</tspan>
              <tspan x={left ? n.x - 8 : n.x + 22} dy={15} fill="#3A4A63" fontSize={11.5}>
                {format(n.value)}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
