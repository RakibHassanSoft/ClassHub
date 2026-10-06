'use client';

import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenCheck, CalendarPlus, ClipboardPen, FileCheck2, NotebookPen, Paperclip, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useClassContext } from '@/components/class/class-context';
import { ClassworkCard } from '@/components/classwork/classwork-card';
import { ClassworkComposer, type ComposerMode } from '@/components/classwork/classwork-composer';
import { ClassworkDetail } from '@/components/classwork/classwork-detail';
import { MaterialsView } from '@/components/classwork/materials-view';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { del, errorMessage, get } from '@/lib/api';
import { CLASSWORK_META } from '@/lib/meta';
import { cn } from '@/lib/utils';
import type { ClassworkItem, ClassworkType } from '@/lib/types';

type Tab = 'all' | ClassworkType;
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <Sparkles /> },
  { key: 'class_log', label: 'Class diary', icon: <NotebookPen /> },
  { key: 'homework', label: 'Homework', icon: <ClipboardPen /> },
  { key: 'class_test', label: 'Class tests', icon: <FileCheck2 /> },
  { key: 'exam_syllabus', label: 'Syllabus', icon: <BookOpenCheck /> },
  { key: 'material', label: 'Materials', icon: <Paperclip /> },
];

const CREATE: { mode: ComposerMode; label: string; hint: string; icon: React.ReactNode }[] = [
  { mode: 'today', label: "Today's class", hint: 'Topic covered + notes + homework', icon: <CalendarPlus /> },
  { mode: 'homework', label: 'Homework', hint: 'With deadline and submissions', icon: <ClipboardPen /> },
  { mode: 'class_test', label: 'Class test', hint: 'Date, time and CT syllabus', icon: <FileCheck2 /> },
  { mode: 'exam_syllabus', label: 'Exam syllabus', hint: 'Mid-term or final', icon: <BookOpenCheck /> },
  { mode: 'material', label: 'Material', hint: 'PDF, slides, ZIP, links', icon: <Paperclip /> },
];

function ClassworkInner() {
  const { classroom, isTeacher } = useClassContext();
  const id = classroom._id;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const tab = (params.get('tab') as Tab) || 'all';
  const openItem = params.get('item');
  const [composer, setComposer] = useState<{ mode: ComposerMode; editing?: ClassworkItem } | null>(null);
  const [materialSignal, setMaterialSignal] = useState(0);
  const [deleting, setDeleting] = useState<ClassworkItem | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['class', id, 'classwork'],
    queryFn: () => get<ClassworkItem[]>(`/classes/${id}/classwork`),
  });

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };

  const items = useMemo(() => (data ?? []).filter((w) => w.type !== 'material' && (tab === 'all' || w.type === tab)), [data, tab]);
  const pendingHomework = (data ?? []).filter(
    (w) => w.type === 'homework' && w.allowSubmission && !w.mySubmission && (!w.dueAt || new Date(w.dueAt) > new Date()),
  ).length;

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await del(`/classes/${id}/classwork/${deleting._id}`);
      toast.success('Deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['class', id, 'classwork'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startCreate = (mode: ComposerMode) => {
    if (mode === 'material') {
      setParam('tab', 'material');
      setMaterialSignal((n) => n + 1);
      return;
    }
    setComposer({ mode });
  };

  return (
    <div className="space-y-5">
      {isTeacher && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CREATE.map((c, i) => (
            <button
              key={c.mode}
              type="button"
              onClick={() => startCreate(c.mode)}
              className={cn(
                'group flex cursor-pointer flex-col items-start gap-2 rounded-2xl p-4 text-left transition hover:-translate-y-0.5',
                i === 0
                  ? 'from-brand-600 shadow-brand col-span-2 bg-gradient-to-br to-teal-700 text-white sm:col-span-1'
                  : 'shadow-soft hover:shadow-card border border-slate-200 bg-white',
              )}
            >
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-xl [&_svg]:size-[18px]',
                  i === 0 ? 'bg-white/20' : CLASSWORK_META[c.mode === 'today' ? 'class_log' : c.mode].tone + ' ring-1',
                )}
              >
                {c.icon}
              </span>
              <span className={cn('text-sm font-bold', i === 0 ? 'text-white' : 'text-slate-900')}>
                <Plus className="mr-0.5 inline size-3.5" />
                {c.label}
              </span>
              <span className={cn('text-xs', i === 0 ? 'text-white/80' : 'text-slate-500')}>{c.hint}</span>
            </button>
          ))}
        </div>
      )}

      {!isTeacher && pendingHomework > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900 ring-1 ring-sky-200">
          <ClipboardPen className="size-5 text-sky-600" /> You have {pendingHomework} homework{pendingHomework > 1 ? 's' : ''} to submit.
        </div>
      )}

      <nav className="-mx-4 flex scrollbar-thin gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {TABS.map((t) => {
          const count =
            t.key === 'all'
              ? (data ?? []).filter((w) => w.type !== 'material').length
              : (data ?? []).filter((w) => w.type === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setParam('tab', t.key === 'all' ? null : t.key)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ring-1 transition [&_svg]:size-4',
                tab === t.key ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300',
              )}
            >
              {t.icon}
              {t.label}
              {t.key !== 'material' && count > 0 && (
                <span className={cn('text-xs', tab === t.key ? 'text-white/70' : 'text-slate-400')}>{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {tab === 'material' ? (
        <MaterialsView key={materialSignal} autoOpen={materialSignal > 0} />
      ) : isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={tab === 'all' ? <Sparkles /> : CLASSWORK_META[tab as ClassworkType].icon}
            title={tab === 'all' ? 'Nothing posted yet' : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()} yet`}
            description={
              isTeacher
                ? "Use Today's class after each class to record the topic, share notes and give homework."
                : 'When your teacher posts the class diary, homework, class tests or syllabus, it appears here.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((w) => (
            <ClassworkCard
              key={w._id}
              w={w}
              isTeacher={isTeacher}
              onOpen={() => setParam('item', w._id)}
              onEdit={() => setComposer({ mode: w.type, editing: w })}
              onDelete={() => setDeleting(w)}
            />
          ))}
        </div>
      )}

      {composer && <ClassworkComposer classId={id} mode={composer.mode} editing={composer.editing} onClose={() => setComposer(null)} />}
      {openItem && <ClassworkDetail classId={id} id={openItem} isTeacher={isTeacher} onClose={() => setParam('item', null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title={`Delete "${deleting?.title}"?`}
        description={
          deleting?.type === 'homework' ? 'All student submissions for this homework are deleted too.' : 'Students will no longer see it.'
        }
      />
    </div>
  );
}

export default function ClassworkPage() {
  return (
    <Suspense>
      <ClassworkInner />
    </Suspense>
  );
}
