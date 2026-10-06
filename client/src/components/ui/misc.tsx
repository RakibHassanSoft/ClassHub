'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cn('text-brand-600 size-5 animate-spin', className)} />
);

export const PageLoader = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="grid min-h-[40vh] place-items-center">
    <div className="flex flex-col items-center gap-3 text-sm text-slate-500">
      <Spinner className="size-7" />
      {label}
    </div>
  </div>
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-xl bg-slate-200/70', className)} />
);

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
    {icon && (
      <div className="relative mb-5">
        <div className="bg-brand-100/60 absolute inset-0 scale-150 rounded-full blur-xl" />
        <div className="from-brand-50 text-brand-600 ring-brand-100 relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br to-teal-50 ring-1 [&_svg]:size-7">
          {icon}
        </div>
      </div>
    )}
    <h3 className="text-base font-bold">{title}</h3>
    {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>}
    {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);

const avatarColors = [
  'from-emerald-400 to-teal-500',
  'from-sky-400 to-indigo-500',
  'from-violet-400 to-fuchsia-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-pink-500',
  'from-cyan-400 to-sky-500',
];

export const Avatar = ({
  name,
  src,
  size = 'md',
  className,
}: {
  name?: string;
  /** optional profile photo URL */
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const idx = (name ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length;
  const s = size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm';
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- profile photo URL
      <img
        src={src}
        alt={name ?? ''}
        referrerPolicy="no-referrer"
        className={cn('shrink-0 rounded-full bg-slate-100 object-cover ring-2 ring-white', s, className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white',
        avatarColors[idx],
        s,
        className,
      )}
    >
      {initials(name)}
    </div>
  );
};

export const Switch = ({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50',
      checked ? 'bg-brand-500' : 'bg-slate-300',
    )}
  >
    <span
      className={cn(
        'inline-block size-5 rounded-full bg-white shadow-md transition-transform',
        checked ? 'translate-x-5.5' : 'translate-x-0.5',
      )}
    />
  </button>
);

export const StatTile = ({
  label,
  value,
  icon,
  hint,
  accent = 'emerald',
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  accent?: 'emerald' | 'teal' | 'sky' | 'amber' | 'rose' | 'violet';
}) => {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    teal: 'bg-teal-50 text-teal-600 ring-teal-100',
    sky: 'bg-sky-50 text-sky-600 ring-sky-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
    rose: 'bg-rose-50 text-rose-600 ring-rose-100',
    violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  };
  return (
    <div className="shadow-card rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {icon && <div className={cn('grid size-9 place-items-center rounded-xl ring-1 [&_svg]:size-[18px]', tones[accent])}>{icon}</div>}
      </div>
      <p className="font-display mt-2 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
};
