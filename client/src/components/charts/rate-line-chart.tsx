'use client';

import { useState } from 'react';
import { useWidth } from './use-width';

export interface RatePoint {
  key: string;
  label: string; // x-axis label, e.g. "12 Sep"
  sublabel?: string; // tooltip line, e.g. topic
  rate: number | null; // 0–100
  detail?: string; // tooltip line, e.g. "18 of 24 present"
}

const H = 240;
const M = { top: 16, right: 16, bottom: 30, left: 40 };
const TICKS = [0, 25, 50, 75, 100];

/** Single-series line (0–100%) with a threshold reference line and crosshair tooltip. */
export const RateLineChart = ({ points, threshold, ariaLabel }: { points: RatePoint[]; threshold: number; ariaLabel: string }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(width, 280);
  const iw = w - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const n = points.length;
  const x = (i: number) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => M.top + ih - (v / 100) * ih;

  const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.rate !== null) as (RatePoint & { i: number; rate: number })[];
  const path = valid.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.rate).toFixed(1)}`).join('');
  const area = valid.length > 1 ? `${path}L${x(valid.at(-1)!.i)},${y(0)}L${x(valid[0].i)},${y(0)}Z` : '';
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round((px / rect.width) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={w} height={H} role="img" aria-label={ariaLabel} className="block select-none">
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[11px] tabular-nums">
                {t}%
              </text>
            </g>
          ))}
          <line x1={M.left} x2={w - M.right} y1={y(threshold)} y2={y(threshold)} stroke="#f43f5e" strokeWidth={1} strokeOpacity={0.6} />
          <text x={w - M.right} y={y(threshold) - 6} textAnchor="end" className="fill-rose-600 text-[11px] font-semibold">
            Minimum {threshold}%
          </text>
          {area && <path d={area} fill="#10b981" fillOpacity={0.1} />}
          <path d={path} fill="none" stroke="#059669" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) =>
            i % labelEvery === 0 || i === n - 1 ? (
              <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                {p.label}
              </text>
            ) : null,
          )}
          {valid.length > 0 && hover === null && (
            <circle cx={x(valid.at(-1)!.i)} cy={y(valid.at(-1)!.rate)} r={4.5} fill="#059669" stroke="#fff" strokeWidth={2} />
          )}
          {hp && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + ih} stroke="#94a3b8" strokeWidth={1} />
              {hp.rate !== null && <circle cx={x(hover)} cy={y(hp.rate)} r={5} fill="#059669" stroke="#fff" strokeWidth={2} />}
            </g>
          )}
          <rect
            x={M.left}
            y={M.top}
            width={iw}
            height={ih}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hp && hover !== null && (
        <div
          className="shadow-lift pointer-events-none absolute top-2 z-10 min-w-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
          style={{ left: Math.min(Math.max(x(hover) - 72, 0), w - 160) }}
        >
          <p className="font-semibold text-slate-800">{hp.label}</p>
          {hp.sublabel && <p className="truncate text-slate-500">{hp.sublabel}</p>}
          <p className="mt-1 flex items-center gap-1.5 text-slate-700">
            <span className="size-2 rounded-full bg-emerald-600" />
            <span className="font-bold tabular-nums">{hp.rate === null ? '—' : `${hp.rate}%`}</span> present
          </p>
          {hp.detail && <p className="text-slate-500">{hp.detail}</p>}
        </div>
      )}
    </div>
  );
};
