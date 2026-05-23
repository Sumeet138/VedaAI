'use client';

import { useEffect, useState } from 'react';
import mermaid from 'mermaid';

let initialized = false;
function initMermaid() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
    // CRITICAL: stop mermaid from drawing its own bomb-icon error SVG into the DOM
    // when render fails. We handle errors via our own clean placeholder.
    suppressErrorRendering: true,
  });
  initialized = true;
}

export default function MermaidRenderer({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initMermaid();
    let cancelled = false;
    const id = 'mermaid-' + Math.random().toString(36).slice(2);
    const trimmed = chart.trim();
    // Pre-validate via mermaid.parse — catches syntax errors before the heavier
    // render path. Failure here means LLM emitted invalid grammar.
    Promise.resolve()
      .then(() => mermaid.parse(trimmed))
      .then(() => mermaid.render(id, trimmed))
      .then((res) => {
        if (!cancelled) setSvg(res.svg);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        // Log full error for debugging, show clean fallback in the UI/PDF.
        console.warn('[mermaid] diagram failed:', msg, '\nSource:', trimmed.slice(0, 200));
        if (!cancelled) setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div
        data-mermaid-status="error"
        className="my-3 px-3 py-2 text-[12px] text-zinc-500 bg-zinc-50 border border-dashed border-zinc-300 rounded-lg italic"
      >
        Diagram unavailable for this question.
      </div>
    );
  }
  if (!svg) {
    return <div data-mermaid-status="pending" className="my-3 text-[12px] text-zinc-400 italic">Rendering diagram…</div>;
  }
  return (
    <div
      data-mermaid-status="done"
      className="my-3 flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
