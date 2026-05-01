'use client';

import { useMemo, useState } from 'react';

type Series = {
  label: string;
  color: string;
  values: number[];
};

type Props = {
  labels: string[];
  series: Series[];
  height?: number;
  yLabel?: string;
};

// Catmull-Rom -> Cubic Bezier smoothing for wave-like lines
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  const tension = 0.35;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function LineWaveChart({ labels, series, height = 320 }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const W = 1000;
  const H = height;
  const padL = 56, padR = 24, padT = 16, padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const allValues = series.flatMap(s => s.values);
  const yMax = Math.max(1, ...allValues);
  const yTicks = niceTicks(yMax, 5);

  const points = useMemo(() => {
    const n = labels.length;
    if (n === 0) return [];
    const xStep = n === 1 ? innerW : innerW / (n - 1);
    return series.map(s => ({
      ...s,
      pts: s.values.map((v, i) => ({
        x: padL + i * xStep,
        y: padT + innerH - (v / Math.max(yTicks[yTicks.length - 1], 1)) * innerH,
      })),
    }));
  }, [labels, series, innerW, innerH, padL, padT, yTicks]);

  const xStep = labels.length <= 1 ? innerW : innerW / (labels.length - 1);
  const xTickStride = Math.max(1, Math.ceil(labels.length / 8));

  // Mouse handler returns nearest data index
  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    if (x < padL || x > W - padR) { setHoverIdx(null); return; }
    const idx = Math.round((x - padL) / xStep);
    setHoverIdx(Math.max(0, Math.min(labels.length - 1, idx)));
  }

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        preserveAspectRatio="none"
      >
        <defs>
          {points.map((p, i) => (
            <linearGradient id={`grad-${i}`} key={`g-${i}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor={p.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={p.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid + Y labels */}
        {yTicks.map((t, i) => {
          const y = padT + innerH - (t / yTicks[yTicks.length - 1]) * innerH;
          return (
            <g key={`y-${i}`}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 4" />
              <text x={padL - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{t.toLocaleString()}</text>
            </g>
          );
        })}

        {/* X labels */}
        {labels.map((l, i) => {
          if (i % xTickStride !== 0 && i !== labels.length - 1) return null;
          const x = padL + i * xStep;
          return (
            <text key={`x-${i}`} x={x} y={H - padB + 22} textAnchor="middle" fontSize="11" fill="#64748b">{l}</text>
          );
        })}

        {/* Series areas + lines */}
        {points.map((p, i) => {
          const linePath = buildSmoothPath(p.pts);
          const areaPath = p.pts.length > 0
            ? `${linePath} L${p.pts[p.pts.length - 1].x},${padT + innerH} L${p.pts[0].x},${padT + innerH} Z`
            : '';
          return (
            <g key={`s-${i}`}>
              <path d={areaPath} fill={`url(#grad-${i})`} />
              <path d={linePath} fill="none" stroke={p.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}

        {/* Hover line + dots + tooltip */}
        {hoverIdx !== null && labels[hoverIdx] !== undefined && (
          <g>
            <line
              x1={padL + hoverIdx * xStep}
              x2={padL + hoverIdx * xStep}
              y1={padT}
              y2={padT + innerH}
              stroke="#475569"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            {points.map((p, i) => {
              const pt = p.pts[hoverIdx];
              if (!pt) return null;
              return (
                <circle key={`d-${i}`} cx={pt.x} cy={pt.y} r="5" fill={p.color} stroke="#0f172a" strokeWidth="2" />
              );
            })}
            {(() => {
              const tx = padL + hoverIdx * xStep;
              const flip = tx > W * 0.7;
              const boxW = 200;
              const boxX = flip ? tx - boxW - 12 : tx + 12;
              return (
                <foreignObject x={boxX} y={padT + 4} width={boxW} height={28 + series.length * 22}>
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155',
                    borderRadius: 8, padding: '8px 12px', color: '#e2e8f0',
                    fontSize: 12, fontFamily: 'system-ui, sans-serif'
                  }}>
                    <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>{labels[hoverIdx]}</div>
                    {points.map((p, i) => (
                      <div key={`t-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ width: 8, height: 8, background: p.color, borderRadius: '50%', display: 'inline-block' }} />
                        <span style={{ color: '#cbd5e1' }}>{p.label}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{p.values[hoverIdx]?.toLocaleString() ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </foreignObject>
              );
            })()}
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 flex-wrap">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.color }} />
            <span className="text-slate-300">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function niceTicks(max: number, count: number): number[] {
  const step = niceStep(max / count);
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top; v += step) out.push(v);
  return out;
}

function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / exp;
  let nice;
  if (n < 1.5) nice = 1;
  else if (n < 3) nice = 2;
  else if (n < 7) nice = 5;
  else nice = 10;
  return nice * exp;
}
