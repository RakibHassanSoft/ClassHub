/**
 * Full class strings so Tailwind can see them at build time.
 * Used for class covers and attendance status chips.
 */
export const CLASS_COLORS = ['emerald', 'teal', 'cyan', 'sky', 'indigo', 'violet', 'rose', 'amber'] as const;
export type ClassColor = (typeof CLASS_COLORS)[number];

export const coverGradient: Record<string, string> = {
  emerald: 'from-emerald-500 via-emerald-600 to-teal-700',
  teal: 'from-teal-500 via-teal-600 to-cyan-700',
  cyan: 'from-cyan-500 via-cyan-600 to-sky-700',
  sky: 'from-sky-500 via-sky-600 to-indigo-600',
  indigo: 'from-indigo-500 via-indigo-600 to-violet-700',
  violet: 'from-violet-500 via-violet-600 to-fuchsia-700',
  rose: 'from-rose-500 via-rose-600 to-pink-700',
  amber: 'from-amber-500 via-orange-500 to-rose-500',
};

export const swatch: Record<string, string> = {
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  cyan: 'bg-cyan-500',
  sky: 'bg-sky-500',
  indigo: 'bg-indigo-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
};

export const softTone: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

/** Solid chip used when a status is selected in the attendance sheet. */
export const solidTone: Record<string, string> = {
  emerald: 'bg-emerald-500 text-white ring-emerald-500',
  teal: 'bg-teal-500 text-white ring-teal-500',
  cyan: 'bg-cyan-500 text-white ring-cyan-500',
  sky: 'bg-sky-500 text-white ring-sky-500',
  indigo: 'bg-indigo-500 text-white ring-indigo-500',
  violet: 'bg-violet-500 text-white ring-violet-500',
  rose: 'bg-rose-500 text-white ring-rose-500',
  amber: 'bg-amber-500 text-white ring-amber-500',
  slate: 'bg-slate-500 text-white ring-slate-500',
};

export const tone = (map: Record<string, string>, color?: string) => map[color ?? 'slate'] ?? map.slate;
