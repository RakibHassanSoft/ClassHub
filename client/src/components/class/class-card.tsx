import Link from 'next/link';
import { Archive, Users } from 'lucide-react';
import type { Classroom } from '@/lib/types';
import { coverGradient, tone } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';

export const ClassCard = ({ c }: { c: Classroom }) => (
  <Link
    href={`/classes/${c._id}`}
    className="group shadow-card hover:shadow-lift flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition duration-200 hover:-translate-y-0.5"
  >
    <div className={cn('relative h-28 bg-gradient-to-br p-5 text-white', tone(coverGradient, c.color))}>
      <div className="absolute -top-8 -right-8 size-32 rounded-full bg-white/10 transition group-hover:scale-110" />
      <div className="absolute right-10 -bottom-10 size-24 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-white/80 uppercase">
          {[c.courseCode, c.section && `Sec ${c.section}`].filter(Boolean).join(' · ') || 'Class'}
        </p>
        {c.archived ? (
          <span className="flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">
            <Archive className="size-3" /> Archived
          </span>
        ) : (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold capitalize backdrop-blur">{c.myRole}</span>
        )}
      </div>
      <h3 className="font-display relative mt-2 line-clamp-2 text-lg leading-snug font-bold text-white">{c.title}</h3>
    </div>
    <div className="flex flex-1 items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={c.owner?.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{c.owner?.name}</p>
          <p className="truncate text-xs text-slate-500">{c.semester || 'Teacher'}</p>
        </div>
      </div>
      {c.myRole === 'teacher' && (
        <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          <Users className="size-3.5" />
          {c.stats.joined}/{c.stats.students}
        </span>
      )}
    </div>
  </Link>
);
