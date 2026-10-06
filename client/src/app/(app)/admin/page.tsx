'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, Clock, GraduationCap, Search, ShieldCheck, ShieldX, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, get, patch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Avatar, EmptyState, Spinner, StatTile } from '@/components/ui/misc';
import { cn, timeAgo } from '@/lib/utils';
import type { User } from '@/lib/types';

type AdminUser = User & { classes?: number; reviewedBy?: { name: string } | null; reviewedAt?: string };
type Tab = 'pending' | 'approved' | 'rejected' | 'students';
interface Stats {
  teachers: { pending: number; approved: number; rejected: number };
  students: number;
  classes: number;
  disabled: number;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Teachers' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'students', label: 'Students' },
];

export default function AdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const [rejecting, setRejecting] = useState<AdminUser | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const { data: stats } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => get<Stats>('/admin/stats') });
  const params = tab === 'students' ? { role: 'student' } : { role: 'teacher', status: tab };
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users', tab, search],
    queryFn: () => get<AdminUser[]>('/admin/users', { ...params, search: search.trim() || undefined }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const review = async (u: AdminUser, status: 'approved' | 'rejected', reason?: string) => {
    setBusy(u._id);
    try {
      await patch(`/admin/teachers/${u._id}`, { status, note: reason || undefined });
      toast.success(status === 'approved' ? `${u.name} can now create classes` : `${u.name} was rejected`);
      setRejecting(null);
      setNote('');
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleActive = async (u: AdminUser) => {
    setBusy(u._id);
    try {
      await patch(`/admin/users/${u._id}/active`, { isActive: u.isActive === false });
      toast.success(u.isActive === false ? 'Account enabled' : 'Account disabled — they cannot log in');
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const count = (t: Tab) =>
    !stats ? undefined : t === 'students' ? stats.students : stats.teachers[t];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <ShieldCheck className="text-brand-600 size-7" /> Admin panel
        </h1>
        <p className="mt-1 text-slate-500">Verify teachers and manage accounts.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Waiting for approval" value={stats?.teachers.pending ?? '–'} icon={<Clock />} accent="amber" />
        <StatTile label="Verified teachers" value={stats?.teachers.approved ?? '–'} icon={<UserCheck />} />
        <StatTile label="Students" value={stats?.students ?? '–'} icon={<GraduationCap />} accent="sky" />
        <StatTile label="Active classes" value={stats?.classes ?? '–'} icon={<BookOpen />} accent="violet" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition',
                tab === t.key ? 'shadow-soft bg-white text-slate-900' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {t.label}
              {count(t.key) !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] font-bold',
                    t.key === 'pending' && count(t.key)! > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600',
                  )}
                >
                  {count(t.key)}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="w-full sm:w-72">
          <Input
            icon={<Search />}
            placeholder={tab === 'students' ? 'Search name, register ID, email' : 'Search name, employee ID, email'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : !users?.length ? (
        <Card>
          <EmptyState
            icon={tab === 'pending' ? <Check /> : <Users />}
            title={tab === 'pending' ? 'No one is waiting' : 'Nobody here yet'}
            description={tab === 'pending' ? 'New teacher sign-ups appear here for you to verify.' : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Card key={u._id} className={cn('p-4 sm:p-5', u.isActive === false && 'opacity-60')} data-testid="admin-user">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar name={u.name} src={u.avatar} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">{u.name}</p>
                    {u.role === 'teacher' && (
                      <Badge color={u.teacherStatus === 'approved' ? 'emerald' : u.teacherStatus === 'rejected' ? 'rose' : 'amber'}>
                        {u.teacherStatus === 'approved' ? 'Verified' : u.teacherStatus === 'rejected' ? 'Rejected' : 'Waiting'}
                      </Badge>
                    )}
                    {u.isActive === false && <Badge color="slate">Disabled</Badge>}
                  </div>
                  <p className="truncate text-sm text-slate-500">{u.email}</p>
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                    {u.role === 'teacher' ? (
                      <>
                        <div>
                          <dt className="inline text-slate-400">Employee ID </dt>
                          <dd className="inline font-mono font-semibold text-slate-800">{u.employeeId || '—'}</dd>
                        </div>
                        <div>
                          <dt className="inline text-slate-400">Department </dt>
                          <dd className="inline font-semibold text-slate-800">{u.department || '—'}</dd>
                        </div>
                        {u.institution && (
                          <div>
                            <dt className="inline text-slate-400">Institution </dt>
                            <dd className="inline font-semibold text-slate-800">{u.institution}</dd>
                          </div>
                        )}
                        {u.teacherStatus === 'approved' && (
                          <div>
                            <dt className="inline text-slate-400">Classes </dt>
                            <dd className="inline font-semibold text-slate-800">{u.classes ?? 0}</dd>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <dt className="inline text-slate-400">Register ID </dt>
                        <dd className="inline font-mono font-semibold text-slate-800">{u.studentId}</dd>
                      </div>
                    )}
                    <div className="text-slate-400">Signed up {timeAgo(u.createdAt)}</div>
                  </dl>
                  {u.teacherStatus === 'rejected' && u.reviewNote && (
                    <p className="mt-2 text-xs text-rose-700">Reason: {u.reviewNote}</p>
                  )}
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  {u.role === 'teacher' && u.teacherStatus !== 'approved' && (
                    <Button size="sm" onClick={() => review(u, 'approved')} loading={busy === u._id} className="flex-1 sm:flex-none">
                      <ShieldCheck /> Approve
                    </Button>
                  )}
                  {u.role === 'teacher' && u.teacherStatus === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-rose-600 sm:flex-none"
                      onClick={() => {
                        setNote('');
                        setRejecting(u);
                      }}
                    >
                      <ShieldX /> Reject
                    </Button>
                  )}
                  {(u.role === 'student' || u.teacherStatus === 'approved') && (
                    <Button size="sm" variant="outline" onClick={() => toggleActive(u)} loading={busy === u._id} className="flex-1 sm:flex-none">
                      {u.isActive === false ? <UserCheck /> : <UserX />} {u.isActive === false ? 'Enable' : 'Disable'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.name ?? ''}?`}
        description="They cannot create classes. The reason is shown to them."
        icon={<ShieldX />}
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy === rejecting?._id} onClick={() => rejecting && review(rejecting, 'rejected', note.trim())}>
              Reject
            </Button>
          </>
        }
      >
        <Field label="Reason (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Employee ID not found. Please contact the CSE office." />
        </Field>
      </Dialog>
    </div>
  );
}
