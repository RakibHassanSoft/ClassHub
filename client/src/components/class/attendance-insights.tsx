'use client';

import { AlertTriangle, Award, CalendarCheck2, Flame, Percent, TrendingUp } from 'lucide-react';
import { useAttendanceAnalytics } from '@/hooks/queries';
import { RateLineChart } from '@/components/charts/rate-line-chart';
import { RateBarChart } from '@/components/charts/rate-bar-chart';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, PageLoader, StatTile } from '@/components/ui/misc';
import { softTone, tone } from '@/lib/colors';
import { cn, formatIsoDate, pluralize } from '@/lib/utils';
import { PercentPill } from './status-chip';

export const AttendanceInsights = ({ classId }: { classId: string }) => {
  const { data, isLoading } = useAttendanceAnalytics(classId);
  if (isLoading || !data) return <PageLoader />;
  if (!data.trend.length) {
    return (
      <Card>
        <EmptyState
          icon={<TrendingUp />}
          title="No insights yet"
          description="Take attendance for a few classes and the trends will appear here."
        />
      </Card>
    );
  }

  const totalMarks = Object.values(data.statusTotals).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Average attendance"
          value={data.overall.averageRate === null ? '—' : `${data.overall.averageRate}%`}
          icon={<Percent />}
        />
        <StatTile label="Classes taken" value={data.overall.classes} icon={<CalendarCheck2 />} accent="teal" />
        <StatTile
          label={`Below ${data.threshold}%`}
          value={data.overall.atRisk}
          icon={<AlertTriangle />}
          accent={data.overall.atRisk ? 'rose' : 'sky'}
          hint={data.overall.atRisk ? 'Need attention' : 'Everyone on track'}
        />
        <StatTile label="Perfect attendance" value={data.overall.perfect} icon={<Award />} accent="violet" />
      </div>

      <Card>
        <CardHeader
          title="Attendance by class day"
          description="Share of marked students who counted as present. Hover a point for details."
          icon={<TrendingUp />}
        />
        <div className="px-3 pt-4 pb-4 sm:px-5">
          <RateLineChart
            ariaLabel="Attendance rate for each class day"
            threshold={data.threshold}
            points={data.trend.map((t) => ({
              key: t._id,
              label: formatIsoDate(t.date, true) + (t.label ? ` ${t.label}` : ''),
              sublabel: t.topic,
              rate: t.rate,
              detail: `${t.present} of ${t.marked} present`,
            }))}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="By weekday" description="Which days students miss most." icon={<CalendarCheck2 />} />
          <div className="px-3 pt-2 pb-4 sm:px-5">
            <RateBarChart
              ariaLabel="Average attendance by weekday"
              threshold={data.threshold}
              bars={data.byWeekday.map((d) => ({
                key: String(d.day),
                label: d.name.slice(0, 3),
                rate: d.rate,
                detail: `${pluralize(d.classes, 'class', 'classes')}, ${d.rate ?? '—'}% present`,
              }))}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="All marks" description={`${totalMarks} marks across every class day`} icon={<Percent />} />
          <div className="space-y-3 p-5 sm:p-6">
            {data.statuses.map((s) => {
              const n = data.statusTotals[s.key] ?? 0;
              const pct = totalMarks ? (n / totalMarks) * 100 : 0;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <span className={cn('rounded-md px-1.5 text-xs font-bold ring-1 ring-inset', tone(softTone, s.color))}>{s.key}</span>
                      {s.label}
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      {n} · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        tone(
                          {
                            emerald: 'bg-emerald-500',
                            rose: 'bg-rose-500',
                            amber: 'bg-amber-500',
                            sky: 'bg-sky-500',
                            violet: 'bg-violet-500',
                            teal: 'bg-teal-500',
                            indigo: 'bg-indigo-500',
                            slate: 'bg-slate-400',
                          },
                          s.color,
                        ),
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Students at risk"
            description={`Below the ${data.threshold}% minimum, lowest first`}
            icon={<AlertTriangle />}
          />
          {!data.atRisk.length ? (
            <p className="p-6 text-sm text-slate-500">No student is below the minimum. 🎉</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {data.atRisk.map((s) => (
                <li key={s._id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{s.name}</p>
                    <p className="font-mono text-xs text-slate-500">{s.studentId}</p>
                  </div>
                  <div className="text-right">
                    <PercentPill value={s.percent} threshold={data.threshold} />
                    <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                      {s.present}/{s.total} classes
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Missed in a row" description="Students absent for their latest 2+ classes" icon={<Flame />} />
          {!data.streaks.length ? (
            <p className="p-6 text-sm text-slate-500">No one has missed two or more classes in a row.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {data.streaks.map((s) => (
                <li key={s._id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">{s.name}</p>
                    <p className="font-mono text-xs text-slate-500">{s.studentId}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                    {s.absentStreak} in a row
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
