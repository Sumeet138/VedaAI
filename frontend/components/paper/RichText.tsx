'use client';

import { InlineMath, BlockMath } from 'react-katex';
import MermaidRenderer from './MermaidRenderer';
import FunctionPlot from './FunctionPlot';

type Segment =
  | { type: 'text'; value: string }
  | { type: 'inline-math'; value: string }
  | { type: 'block-math'; value: string }
  | { type: 'mermaid'; value: string }
  | { type: 'plot'; value: string };

const PATTERN =
  /<mermaid>([\s\S]*?)<\/mermaid>|<plot>([\s\S]*?)<\/plot>|\$\$([\s\S]+?)\$\$|\$([^\n$]+?)\$/g;

export function parseSegments(text: string): Segment[] {
  if (!text) return [];
  const out: Segment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  PATTERN.lastIndex = 0;

  while ((m = PATTERN.exec(text)) !== null) {
    if (m.index > lastIndex) {
      out.push({ type: 'text', value: text.slice(lastIndex, m.index) });
    }
    if (m[1] !== undefined) out.push({ type: 'mermaid', value: m[1] });
    else if (m[2] !== undefined) out.push({ type: 'plot', value: m[2] });
    else if (m[3] !== undefined) out.push({ type: 'block-math', value: m[3] });
    else if (m[4] !== undefined) out.push({ type: 'inline-math', value: m[4] });
    lastIndex = PATTERN.lastIndex;
  }
  if (lastIndex < text.length) {
    out.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return out;
}

function SafeInlineMath({ math }: { math: string }) {
  try {
    return <InlineMath math={math} />;
  } catch {
    return <code className="text-red-600 bg-red-50 px-1 rounded text-[11px]">${math}$</code>;
  }
}

function SafeBlockMath({ math }: { math: string }) {
  try {
    return (
      <div className="my-2">
        <BlockMath math={math} />
      </div>
    );
  } catch {
    return (
      <pre className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded p-2 my-2 whitespace-pre-wrap">
        $$ {math} $$
      </pre>
    );
  }
}

export default function RichText({ text }: { text: string }) {
  const segments = parseSegments(text);
  if (segments.length === 0) return null;
  if (segments.length === 1 && segments[0].type === 'text') {
    return <>{segments[0].value}</>;
  }
  return (
    <>
      {segments.map((s, i) => {
        switch (s.type) {
          case 'text':
            return <span key={i}>{s.value}</span>;
          case 'inline-math':
            return <SafeInlineMath key={i} math={s.value} />;
          case 'block-math':
            return <SafeBlockMath key={i} math={s.value} />;
          case 'mermaid':
            return <MermaidRenderer key={i} chart={s.value} />;
          case 'plot':
            return <FunctionPlot key={i} chart={s.value} />;
        }
      })}
    </>
  );
}
