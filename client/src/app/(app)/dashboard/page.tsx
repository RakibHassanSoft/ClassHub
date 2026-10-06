'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bell, BookOpen, CalendarClock, KeyRound, MapPin, Plus, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { useClasses, useFeed, useMyWeek } from '@/hooks/queries';
import { ClassCard } from '@/components/class/class-card';
import { PushCard } from '@/components/layout/push-card';
import { UpcomingCard } from '@/components/classwork/upcoming-card';
import { CreateClassDialog, JoinClassDialog } from '@/components/class/class-dialogs';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, Skeleton, StatTile } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { NOTICE_META, SLOT_META } from '@/lib/meta';
import { swatch, tone } from '@/lib/colors';
import { cn, DAYS, firstName, formatTime, timeAgo } from '@/lib/utils';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const isTeacher = user?.role === 'teacher';
  const { data: classes, isLoading } = useClasses();
  const { data: week } = useMyWeek();
  const { data: feed } = useFeed();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const today = new Date().getDay();
  const todaySlots = useMemo(() => (week ?? []).filter((s) => s.day === today), [week, today]);
  const active = (classes ?? []).filter((c) => !c.archived);
  const totalStudents = active.reduce((t, c) => t + (c.myRole === 'teacher' ? c.stats.students : 0), 0);

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
            {greeting()}, {firstName(user?.name)}
          </h1>
        </div>
        {isTeacher ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> New class
          </Button>
        ) : (
          <Button onClick={() => setJoinOpen(true)}>
            <KeyRound /> Join a class
          </Button>
        )}
      </div>

      <PushCard compact />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Active classes" value={isLoading ? '–' : active.length} icon={<BookOpen />} />
        {isTeacher ? (
          <StatTile label="Students" value={isLoading ? '–' : totalStudents} icon={<Users />} accent="teal" />
        ) : (
          <StatTile label="Classes this week" value={week?.length ?? '–'} icon={<CalendarClock />} accent="teal" />
        )}
        <StatTile label="Classes today" value={todaySlots.length} icon={<CalendarClock />} accent="sky" hint={DAYS[today]} />
        <StatTile label="Unread notices" value={feed?.unread ?? '–'} icon={<Bell />} accent={feed?.unread ? 'rose' : 'violet'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Your classes</h2>
            {active.length > 0 && (
              <Link href="/classes" className="text-brand-600 hover:text-brand-700 flex items-center gap-1 text-sm font-semibold">
                View all <ArrowRight className="size-4" />
              </Link>
            )}
          </div>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : active.length === 0 ? (
            <Card>
              <EmptyState
                icon={<BookOpen />}
                title={isTeacher ? 'Create your first class' : 'You have not joined any class yet'}
                description={
                  isTeacher
                    ? 'Add a class, upload your student list and share the class code or QR with your students.'
                    : 'Ask your teacher for the class code, then tap Join a class and type it or scan the QR.'
                }
                action={
                  isTeacher ? (
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus /> New class
                    </Button>
                  ) : (
                    <Button onClick={() => setJoinOpen(true)}>
                      <KeyRound /> Join a class
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {active.slice(0, 6).map((c) => (
                <ClassCard key={c._id} c={c} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <UpcomingCard />
          <Card>
            <CardHeader title="Today" description={DAYS[today]} icon={<CalendarClock />} />
            <div className="p-3 pt-4">
              {todaySlots.length === 0 ? (
                <p className="px-3 pb-3 text-sm text-slate-500">No classes scheduled today.</p>
              ) : (
                todaySlots.map((s) => {
                  const cls = typeof s.classroom === 'string' ? null : s.classroom;
                  return (
                    <Link
                      key={s._id}
                      href={cls ? `/classes/${cls._id}` : '#'}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <span className={cn('h-10 w-1 shrink-0 rounded-full', tone(swatch, cls?.color))} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{cls?.courseCode || cls?.title}</p>
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                          {formatTime(s.startTime)} – {formatTime(s.endTime)}
                          {s.room && (
                            <>
                              <MapPin className="size-3" /> {s.room}
                            </>
                          )}
                        </p>
                      </div>
                      <Badge color={SLOT_META[s.type].color}>{SLOT_META[s.type].label}</Badge>
                    </Link>
                  );
                })
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Latest notices"
              icon={<Bell />}
              action={
                <Link href="/notifications" className="text-brand-600 text-sm font-semibold">
                  All
                </Link>
              }
            />
            <div className="p-3 pt-4">
              {!feed?.items.length ? (
                <p className="px-3 pb-3 text-sm text-slate-500">Nothing new. Notices from your classes appear here.</p>
              ) : (
                feed.items.slice(0, 5).map((n) => {
                  const meta = NOTICE_META[n.type];
                  const cls = typeof n.classroom === 'string' ? null : n.classroom;
                  return (
                    <Link
                      key={n._id}
                      href={cls ? `/classes/${cls._id}` : '/notifications'}
                      className="flex gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <div className={cn('grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4', meta.iconBg)}>
                        {meta.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{n.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {cls?.courseCode || cls?.title} · {timeAgo(n.createdAt)}
                        </p>
                      </div>
                      {!n.seen && <span className="bg-brand-500 mt-1.5 size-2 shrink-0 rounded-full" />}
                    </Link>
                  );
                })
              )}
            </div>
          </Card>
        </aside>
      </div>

      <CreateClassDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinClassDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}
