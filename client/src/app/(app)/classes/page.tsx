'use client';

import { useMemo, useState } from 'react';
import { Archive, BookOpen, KeyRound, Plus, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-store';
import { useClasses } from '@/hooks/queries';
import { ClassCard } from '@/components/class/class-card';
import { CreateClassDialog, JoinClassDialog } from '@/components/class/class-dialogs';
import { SemesterExportButton } from '@/components/class/semester-export';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export default function ClassesPage() {
  const isTeacher = useAuth((s) => s.user?.role === 'teacher');
  const { data, isLoading } = useClasses();
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? [])
      .filter((c) => (tab === 'archived' ? c.archived : !c.archived))
      .filter((c) => !term || [c.title, c.courseCode, c.section, c.semester, c.owner?.name].some((v) => v?.toLowerCase().includes(term)));
  }, [data, tab, q]);

  const archivedCount = (data ?? []).filter((c) => c.archived).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">My classes</h1>
          <p className="mt-1 text-slate-500">{isTeacher ? 'Classes you teach' : 'Classes you have joined'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isTeacher && <SemesterExportButton classes={data ?? []} />}
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
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {(['active', 'archived'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition',
                tab === t ? 'shadow-soft bg-white text-slate-900' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {t === 'archived' && <Archive className="size-3.5" />}
              {t}
              {t === 'archived' && archivedCount > 0 && <span className="text-xs text-slate-400">{archivedCount}</span>}
            </button>
          ))}
        </div>
        <div className="sm:w-72">
          <Input placeholder="Search classes" icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={tab === 'archived' ? <Archive /> : <BookOpen />}
            title={q ? 'No classes match your search' : tab === 'archived' ? 'No archived classes' : 'No classes yet'}
            description={
              tab === 'active' && !q
                ? isTeacher
                  ? 'Create a class to get started.'
                  : 'Tap Join a class, then type the class code or scan the QR from your teacher.'
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <ClassCard key={c._id} c={c} />
          ))}
        </div>
      )}

      <CreateClassDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinClassDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  );
}
