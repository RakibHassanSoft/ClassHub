'use client';

import { useState } from 'react';
import { useWidth } from './use-width';

export interface RateBar {
  key: string;
  label: string;
  rate: number | null;
  detail?: string;
}

const H = 220;
const M = { top: 22, right: 8, bottom: 28, left: 8 };

/** Columns of a single 0–100% measure; value on each cap, threshold-colored marks. */
export const RateBarChart = ({ bars, threshold, ariaLabel }: { bars: RateBar[]; threshold: number; ariaLabel: string }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const w = Math.max(width, 240);
  const iw = w - M.left - M.right;
  const ih = H - M.top - M.bottom;
  const band = iw / Math.max(1, bars.length);
  const bw = Math.min(24, band * 0.6);
  const y = (v: number) => M.top + ih - (v / 100) * ih;
  const r = 4;

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg width={w} height={H} role="img" aria-label={ariaLabel} className="block">
          <line x1={M.left} x2={w - M.right} y1={y(0)} y2={y(0)} stroke="#e2e8f0" strokeWidth={1} />
          <line x1={M.left} x2={w - M.right} y1={y(threshold)} y2={y(threshold)} stroke="#f43f5e" strokeWidth={1} strokeOpacity={0.5} />
          {bars.map((b, i) => {
            const cx = M.left + band * i + band / 2;
            const v = b.rate ?? 0;
            const top = y(v);
            const h = Math.max(0, y(0) - top);
            const low = b.rate !== null && b.rate < threshold;
            const fill = low ? '#f43f5e' : '#10b981';
            const d =
              h > r
                ? `M${cx - bw / 2},${y(0)}V${top + r}Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top}H${cx + bw / 2 - r}Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r}V${y(0)}Z`
                : `M${cx - bw / 2},${y(0)}V${top}H${cx + bw / 2}V${y(0)}Z`;
            return (
              <g key={b.key} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <rect x={cx - band / 2} y={M.top} width={band} height={ih} fill={hover === i ? '#f1f5f9' : 'transparent'} />
                <path d={d} fill={fill} opacity={hover === null || hover === i ? 1 : 0.55} />
                <text x={cx} y={top - 6} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold tabular-nums">
                  {b.rate === null ? '—' : `${Math.round(b.rate)}%`}
                </text>
                <text x={cx} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
                  {b.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && bars[hover]?.detail && (
        <div
          className="shadow-lift pointer-events-none absolute top-0 z-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
          style={{ left: Math.min(Math.max(M.left + band * hover + band / 2 - 70, 0), w - 150) }}
        >
          <p className="font-semibold text-slate-800">{bars[hover].label}</p>
          <p className="text-slate-500">{bars[hover].detail}</p>
        </div>
      )}
    </div>
  );
};
