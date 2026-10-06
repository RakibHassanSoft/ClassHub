import { softTone, solidTone, tone } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { AttendanceStatus } from '@/lib/types';

export const StatusChip = ({
  status,
  statuses,
  size = 'md',
  solid = true,
}: {
  status: string;
  statuses: AttendanceStatus[];
  size?: 'sm' | 'md';
  solid?: boolean;
}) => {
  const s = statuses.find((x) => x.key === status);
  const dims = size === 'sm' ? 'size-7 text-[11px]' : 'size-8 text-xs';
  if (!status)
    return (
      <span
        className={cn(
          'inline-grid place-items-center rounded-lg bg-slate-50 font-bold text-slate-300 ring-1 ring-slate-200 ring-inset',
          dims,
        )}
      >
        –
      </span>
    );
  return (
    <span
      title={s?.label ?? status}
      className={cn(
        'inline-grid place-items-center rounded-lg font-bold ring-1 ring-inset',
        dims,
        tone(solid ? solidTone : softTone, s?.color),
      )}
    >
      {status}
    </span>
  );
};

export const PercentPill = ({ value, threshold }: { value: number | null; threshold: number }) => {
  if (value === null) return <span className="text-xs text-slate-400">—</span>;
  const low = value < threshold;
  return (
    <span
      className={cn(
        'inline-flex min-w-14 justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-inset',
        low
          ? 'bg-rose-50 text-rose-700 ring-rose-200'
          : value >= 90
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
            : 'bg-slate-50 text-slate-700 ring-slate-200',
      )}
    >
      {value}%
    </span>
  );
};
