'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  NotebookPen,
  History,
  MessagesSquare,
  LogOut,
  GraduationCap,
  Megaphone,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { useClassroom } from '@/hooks/queries';
import { ClassContext } from '@/components/class/class-context';
import { InviteDialog } from '@/components/class/invite-dialog';
import { CheckinBanner } from '@/components/class/checkin-banner';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { coverGradient, tone } from '@/lib/colors';
import { errorMessage, post } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function ClassLayout({ children }: { children: ReactNode }) {
  const { classId } = useParams<{ classId: string }>();
  const pathname = usePathname();
  const { data: classroom, isLoading, error } = useClassroom(classId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  const leave = async () => {
    setLeaving(true);
    try {
      await post(`/classes/${classId}/leave`);
      toast.success('You left the class');
      await qc.invalidateQueries({ queryKey: ['classes'] });
      router.replace('/classes');
    } catch (err) {
      toast.error(errorMessage(err));
      setLeaving(false);
    }
  };

  if (isLoading) return <PageLoader label="Loading class…" />;
  if (error || !classroom) {
    return (
      <Card>
        <EmptyState
          icon={<GraduationCap />}
          title="Class not available"
          description={errorMessage(error, 'This class does not exist or you are not a member.')}
          action={
            <Link href="/classes">
              <Button variant="outline">
                <ArrowLeft /> Back to classes
              </Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const isTeacher = classroom.myRole === 'teacher';
  const base = `/classes/${classId}`;
  const tabs = [
    { href: base, label: 'Stream', icon: Megaphone, exact: true },
    ...(isTeacher || classroom.settings.chatEnabled !== false ? [{ href: `${base}/chat`, label: 'Chat', icon: MessagesSquare }] : []),
    { href: `${base}/attendance`, label: 'Attendance', icon: ClipboardCheck },
    { href: `${base}/routine`, label: 'Routine', icon: CalendarDays },
    { href: `${base}/classwork`, label: 'Classwork', icon: NotebookPen },
    { href: `${base}/marks`, label: 'Marks', icon: GraduationCap },
    ...(isTeacher
      ? [
          { href: `${base}/students`, label: 'Students', icon: Users },
          { href: `${base}/activity`, label: 'Activity', icon: History },
          { href: `${base}/settings`, label: 'Settings', icon: Settings },
        ]
      : []),
  ];

  return (
    <ClassContext.Provider value={{ classroom, isTeacher }}>
      <div className="space-y-6">
        <div
          className={cn(
            'no-print shadow-card relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white sm:p-8',
            tone(coverGradient, classroom.color),
          )}
        >
          <div className="absolute -top-16 -right-16 size-64 rounded-full bg-white/10" />
          <div className="absolute right-24 -bottom-24 size-48 rounded-full bg-white/10" />
          <div className="bg-grid absolute inset-0 opacity-20 [filter:invert(1)]" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <Link href="/classes" className="inline-flex items-center gap-1 text-xs font-semibold text-white/75 hover:text-white">
                <ArrowLeft className="size-3.5" /> All classes
              </Link>
              <p className="mt-3 text-xs font-bold tracking-wider text-white/80 uppercase">
                {[classroom.courseCode, classroom.section && `Section ${classroom.section}`, classroom.semester]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <h1 className="font-display mt-1 text-2xl font-extrabold text-white sm:text-3xl">{classroom.title}</h1>
              <p className="mt-2 text-sm text-white/80">
                {classroom.owner?.name}
                {classroom.room && ` · ${classroom.room}`}
                {classroom.archived && ' · Archived'}
                {classroom.isCR && ' · You are a class representative'}
              </p>
            </div>
            {(!isTeacher || !classroom.isOwner) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white/80 hover:bg-white/15 hover:text-white"
                onClick={() => setLeaveOpen(true)}
              >
                <LogOut /> Leave class
              </Button>
            )}
            {isTeacher && (
              <div className="flex items-center gap-3">
                <div className="hidden rounded-xl bg-white/15 px-4 py-2 text-right ring-1 ring-white/20 backdrop-blur sm:block">
                  <p className="text-[11px] font-semibold text-white/75 uppercase">Joined</p>
                  <p className="font-display text-lg font-bold">
                    {classroom.stats.joined}
                    <span className="text-white/60">/{classroom.stats.students}</span>
                  </p>
                </div>
                <Button variant="outline" className="border-0 text-slate-800" onClick={() => setInviteOpen(true)}>
                  <UserPlus /> Invite
                </Button>
              </div>
            )}
          </div>
        </div>

        <nav className="no-print -mx-4 scrollbar-thin overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="shadow-soft inline-flex min-w-full gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 sm:min-w-0">
            {tabs.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition',
                    active ? 'bg-brand-50 text-brand-700 ring-brand-100 ring-1' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        {!isTeacher && <CheckinBanner classId={classroom._id} />}

        <div className="animate-fade-in">{children}</div>
      </div>
      {isTeacher && <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} classroom={classroom} />}
      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={leave}
        loading={leaving}
        title={`Leave ${classroom.title}?`}
        description="You can join again later with the class code."
        confirmLabel="Leave class"
      />
    </ClassContext.Provider>
  );
}
