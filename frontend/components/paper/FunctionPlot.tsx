'use client';

import { useEffect, useRef, useState } from 'react';

interface PlotData {
  fn?: string;
  graphType?: 'polyline' | 'scatter' | 'interval';
  fnType?: 'linear' | 'implicit' | 'parametric' | 'polar' | 'points';
  points?: Array<[number, number]>;
  color?: string;
  r?: string;
  x?: string;
  y?: string;
}

interface PlotSpec {
  fn?: string;
  data?: PlotData[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  grid?: boolean;
  points?: Array<[number, number]>;
  width?: number;
  height?: number;
}

function parseSpec(raw: string): PlotSpec | { error: string } {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as PlotSpec;
  } catch {
    return { error: 'plot must be valid JSON' };
  }
}

// function-plot's `fn` field never accepts `=`. Strip it regardless of fnType.
// Cases covered:
//   "x^2 + y^2 = 4"       → fn: "(x^2 + y^2) - (4)",      fnType: implicit
//   "x^2 + y^2 - 4 = 0"   → fn: "(x^2 + y^2 - 4) - (0)",  fnType: implicit (LLM-tagged)
//   "y = 2x + 1"          → fn: "2x + 1"                  (explicit y=… form)
//   "x^2"                 → unchanged
function normalizeFn(d: PlotData): PlotData {
  if (!d.fn) return d;
  let fn = d.fn.trim();
  let fnType = d.fnType;

  // Strip `=` whenever present — function-plot can't parse equations directly.
  if (fn.includes('=')) {
    const parts = fn.split('=');
    if (parts.length === 2) {
      const [lhs, rhs] = parts.map((s) => s.trim());
      // Explicit form "y = f(x)" → drop the y, keep f(x).
      if (/^y$/i.test(lhs)) {
        fn = rhs;
      } else if (/^y$/i.test(rhs)) {
        fn = lhs;
      } else {
        // True implicit equation: move everything to one side.
        fn = `(${lhs}) - (${rhs})`;
        fnType = fnType ?? 'implicit';
      }
    } else {
      // More than one `=` — give up cleanly; fall through with original fn.
    }
  }

  // Heuristic: free `y` variable (other than the explicit form above) → implicit.
  if (!fnType && /\by\b/.test(fn)) {
    fnType = 'implicit';
  }

  return { ...d, fn, fnType };
}

// Scatter/points data needs explicit fnType:'points' or function-plot crashes
// inside builtIn sampler trying to read `.eval` on a missing fn.
function normalizePoints(d: PlotData): PlotData {
  if (d.points && !d.fn && !d.r) {
    return {
      ...d,
      fnType: d.fnType ?? 'points',
      graphType: d.graphType ?? 'scatter',
    };
  }
  return d;
}

// Implicit equations require the `interval` sampler. function-plot picks
// that automatically when graphType === 'interval', but errors otherwise.
function applyImplicitSampler(d: PlotData): PlotData {
  if (d.fnType === 'implicit' && d.graphType !== 'interval') {
    return { ...d, graphType: 'interval' };
  }
  return d;
}

function pipe(d: PlotData): PlotData {
  return applyImplicitSampler(normalizePoints(normalizeFn(d)));
}

function normalize(spec: PlotSpec): {
  data: PlotData[];
  xDomain: [number, number];
  yDomain: [number, number];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  width: number;
  height: number;
} {
  const data: PlotData[] = [];
  if (spec.data?.length) data.push(...spec.data.map(pipe));
  if (spec.fn) data.push(pipe({ fn: spec.fn, graphType: 'polyline' }));
  if (spec.points?.length) data.push(pipe({ points: spec.points }));

  return {
    data,
    xDomain: spec.xDomain ?? [-10, 10],
    yDomain: spec.yDomain ?? [-10, 10],
    title: spec.title,
    xLabel: spec.xLabel,
    yLabel: spec.yLabel,
    width: spec.width ?? 460,
    height: spec.height ?? 320,
  };
}

type Status = 'pending' | 'done' | 'error';

export default function FunctionPlot({ chart }: { chart: string }) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>('pending');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseSpec(chart);
    if ('error' in parsed) {
      setErrMsg(parsed.error);
      setStatus('error');
      return;
    }
    const cfg = normalize(parsed);
    if (cfg.data.length === 0) {
      setErrMsg('plot requires fn, data, or points');
      setStatus('error');
      return;
    }

    let cancelled = false;
    import('function-plot')
      .then(({ default: functionPlot }) => {
        if (cancelled || !targetRef.current) return;
        targetRef.current.innerHTML = '';
        try {
          functionPlot({
            target: targetRef.current,
            width: cfg.width,
            height: cfg.height,
            grid: true,
            title: cfg.title,
            xAxis: { domain: cfg.xDomain, label: cfg.xLabel },
            yAxis: { domain: cfg.yDomain, label: cfg.yLabel },
            data: cfg.data.map((d) => ({
              ...(d.fn ? { fn: d.fn } : {}),
              ...(d.points ? { points: d.points } : {}),
              ...(d.r ? { r: d.r } : {}),
              ...(d.x ? { x: d.x } : {}),
              ...(d.y ? { y: d.y } : {}),
              ...(d.fnType ? { fnType: d.fnType } : {}),
              graphType: d.graphType ?? 'polyline',
              ...(d.color ? { color: d.color } : {}),
            })),
          });
          if (!cancelled) {
            setStatus('done');
            setErrMsg(null);
          }
        } catch (e) {
          if (!cancelled) {
            setErrMsg(e instanceof Error ? e.message : String(e));
            setStatus('error');
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErrMsg(e instanceof Error ? e.message : 'function-plot failed to load');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (status === 'error') {
    // Log the gory details for debugging; show a clean fallback in the rendered paper / PDF.
    if (typeof window !== 'undefined') {
      console.warn('[plot] graph failed:', errMsg, '\nSource:', chart.slice(0, 200));
    }
    return (
      <div
        data-plot-status="error"
        className="my-3 px-3 py-2 text-[12px] text-zinc-500 bg-zinc-50 border border-dashed border-zinc-300 rounded-lg italic"
      >
        Graph unavailable for this question.
      </div>
    );
  }
  return (
    <div data-plot-status={status} className="my-3 flex justify-center [&_svg]:max-w-full">
      <div ref={targetRef} />
    </div>
  );
}
