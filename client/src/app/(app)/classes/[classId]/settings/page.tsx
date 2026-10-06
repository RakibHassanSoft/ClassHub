'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ClipboardCheck,
  CopyPlus,
  MessagesSquare,
  Plus,
  Save,
  Settings2,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useClassContext } from '@/components/class/class-context';
import { ColorPicker, CreateClassDialog } from '@/components/class/class-dialogs';
import { TeachersCard } from '@/components/class/teachers-card';
import { RemindersCard } from '@/components/class/reminders-card';
import { qk, useRoutine } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { del, errorMessage, patch } from '@/lib/api';
import { softTone, tone } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { AttendanceStatus } from '@/lib/types';

const STATUS_COLORS = ['emerald', 'rose', 'amber', 'sky', 'violet', 'teal', 'indigo', 'slate'];

export default function SettingsPage() {
  const { classroom } = useClassContext();
  const id = classroom._id;
  const { data: slots } = useRoutine(id);
  const router = useRouter();
  const qc = useQueryClient();

  const [info, setInfo] = useState({
    title: classroom.title,
    courseCode: classroom.courseCode ?? '',
    section: classroom.section ?? '',
    semester: classroom.semester ?? '',
    room: classroom.room ?? '',
    description: classroom.description ?? '',
    color: classroom.color,
  });
  const [statuses, setStatuses] = useState<AttendanceStatus[]>(classroom.settings.attendanceStatuses);
  const [showAttendance, setShowAttendance] = useState(classroom.settings.showAttendanceToStudents);
  const [threshold, setThreshold] = useState(String(classroom.settings.lowAttendanceThreshold));
  const [chat, setChat] = useState({
    chatEnabled: classroom.settings.chatEnabled !== false,
    chatTeacherOnly: Boolean(classroom.settings.chatTeacherOnly),
    allowStudentDirect: classroom.settings.allowStudentDirect !== false,
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.class(id) });
    qc.invalidateQueries({ queryKey: qk.classes });
  };

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setSaving(key);
    try {
      await fn();
      toast.success(msg);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const saveInfo = () =>
    run(
      'info',
      () =>
        patch(`/classes/${id}`, {
          ...info,
          title: info.title.trim(),
        }),
      'Class details saved',
    );

  const saveAttendance = () => {
    const keys = statuses.map((s) => s.key.trim().toUpperCase());
    if (keys.some((k) => !k) || statuses.some((s) => !s.label.trim())) {
      toast.error('Every status needs a code and a name');
      return;
    }
    if (new Set(keys).size !== keys.length) {
      toast.error('Status codes must be different');
      return;
    }
    run(
      'attendance',
      () =>
        patch(`/classes/${id}`, {
          settings: {
            attendanceStatuses: statuses.map((s) => ({ ...s, key: s.key.trim().toUpperCase(), label: s.label.trim() })),
            showAttendanceToStudents: showAttendance,
            lowAttendanceThreshold: Math.min(100, Math.max(0, Number(threshold) || 0)),
          },
        }),
      'Attendance settings saved',
    );
  };

  const updateStatus = (i: number, p: Partial<AttendanceStatus>) => setStatuses((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const toggleArchive = () =>
    run(
      'archive',
      () => patch(`/classes/${id}`, { archived: !classroom.archived }),
      classroom.archived ? 'Class restored' : 'Class archived',
    );

  const remove = async () => {
    setSaving('delete');
    try {
      await del(`/classes/${id}`);
      toast.success('Class deleted');
      qc.invalidateQueries({ queryKey: qk.classes });
      router.replace('/classes');
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader title="Class details" description="Shown to your students on the class page." icon={<Settings2 />} />
        <CardBody className="space-y-4">
          <Field label="Class name" required>
            <Input value={info.title} onChange={(e) => setInfo({ ...info, title: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Course code">
              <Input value={info.courseCode} onChange={(e) => setInfo({ ...info, courseCode: e.target.value })} />
            </Field>
            <Field label="Section">
              <Input value={info.section} onChange={(e) => setInfo({ ...info, section: e.target.value })} />
            </Field>
            <Field label="Semester">
              <Input value={info.semester} onChange={(e) => setInfo({ ...info, semester: e.target.value })} />
            </Field>
          </div>
          <Field label="Room">
            <Input value={info.room} onChange={(e) => setInfo({ ...info, room: e.target.value })} />
          </Field>
          <Field label="Description">
            <Textarea value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
          </Field>
          <Field label="Cover colour">
            <ColorPicker value={info.color} onChange={(color) => setInfo({ ...info, color })} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={saveInfo} loading={saving === 'info'} disabled={info.title.trim().length < 2}>
              <Save /> Save details
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Attendance" description="Customise the statuses you mark and what students can see." icon={<ClipboardCheck />} />
        <CardBody className="space-y-5">
          <div className="space-y-2.5">
            <div className="hidden grid-cols-[72px_1fr_120px_130px_36px] gap-2 px-1 text-xs font-semibold text-slate-500 sm:grid">
              <span>Code</span>
              <span>Name</span>
              <span>Colour</span>
              <span>Counts as</span>
              <span />
            </div>
            {statuses.map((s, i) => (
              <div
                key={i}
                className="grid grid-cols-[64px_1fr_36px] gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/70 sm:grid-cols-[72px_1fr_120px_130px_36px] sm:bg-transparent sm:p-0 sm:ring-0"
              >
                <Input
                  value={s.key}
                  maxLength={3}
                  className={cn('h-10 text-center font-bold uppercase', tone(softTone, s.color))}
                  onChange={(e) => updateStatus(i, { key: e.target.value.toUpperCase() })}
                  aria-label="Status code"
                />
                <Input
                  value={s.label}
                  maxLength={24}
                  className="h-10"
                  onChange={(e) => updateStatus(i, { label: e.target.value })}
                  aria-label="Status name"
                />
                <button
                  type="button"
                  disabled={statuses.length <= 2}
                  onClick={() => setStatuses((x) => x.filter((_, j) => j !== i))}
                  className="grid size-10 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 sm:order-last"
                  aria-label="Remove status"
                >
                  <Trash2 className="size-4" />
                </button>
                <Select
                  value={s.color}
                  className="col-span-1 h-10 capitalize"
                  onChange={(e) => updateStatus(i, { color: e.target.value })}
                  aria-label="Colour"
                >
                  {STATUS_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
                <Select
                  value={s.countsAsPresent ? 'present' : 'absent'}
                  className="col-span-2 h-10 sm:col-span-1"
                  onChange={(e) => updateStatus(i, { countsAsPresent: e.target.value === 'present' })}
                  aria-label="Counts as"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </Select>
              </div>
            ))}
            {statuses.length < 8 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatuses((x) => [...x, { key: '', label: '', color: 'violet', countsAsPresent: true }])}
              >
                <Plus /> Add status (e.g. Medical)
              </Button>
            )}
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Students can see their attendance</p>
                <p className="text-xs text-slate-500">Each student sees only their own record and percentage.</p>
              </div>
              <Switch checked={showAttendance} onChange={setShowAttendance} label="Show attendance to students" />
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Minimum attendance</p>
                <p className="text-xs text-slate-500">Students below this are highlighted in red.</p>
              </div>
              <div className="flex w-28 items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="h-10 text-center"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveAttendance} loading={saving === 'attendance'}>
              <Save /> Save attendance settings
            </Button>
          </div>
        </CardBody>
      </Card>

      <RemindersCard classId={id} slotCount={slots?.length} />

      <TeachersCard classroom={classroom} />

      <Card>
        <CardHeader title="Chat" description="Control how students talk in this class." icon={<MessagesSquare />} />
        <CardBody className="space-y-5">
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {(
              [
                ['chatEnabled', 'Class group chat', 'A group conversation for everyone in the class.'],
                ['chatTeacherOnly', 'Only teachers can post', 'Students can read the group chat but not write (announcement mode).'],
                ['allowStudentDirect', 'Students can message teachers privately', 'One-to-one chats between a student and the teacher.'],
              ] as const
            ).map(([key, title, hint]) => (
              <div key={key} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{title}</p>
                  <p className="text-xs text-slate-500">{hint}</p>
                </div>
                <Switch
                  checked={chat[key]}
                  disabled={key === 'chatTeacherOnly' && !chat.chatEnabled}
                  onChange={(v) => setChat({ ...chat, [key]: v })}
                  label={title}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => run('chat', () => patch(`/classes/${id}`, { settings: chat }), 'Chat settings saved')}
              loading={saving === 'chat'}
            >
              <Save /> Save chat settings
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Use as a template"
          description="Start next semester's class with this class's settings, routine, resources and assessments."
          icon={<CopyPlus />}
        />
        <CardBody className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => setTemplateOpen(true)}>
            <CopyPlus /> Create class from this one
          </Button>
        </CardBody>
      </Card>
      {templateOpen && <CreateClassDialog open sourceId={id} onClose={() => setTemplateOpen(false)} />}

      <Card className="border-rose-200">
        <CardHeader
          title="Danger zone"
          icon={<TriangleAlert />}
          className="[&_div>div:first-child]:bg-rose-50 [&_div>div:first-child]:text-rose-600 [&_div>div:first-child]:ring-rose-100"
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{classroom.archived ? 'Restore class' : 'Archive class'}</p>
              <p className="text-xs text-slate-500">Archived classes are read-only history at the end of a semester.</p>
            </div>
            <Button variant="outline" onClick={toggleArchive} loading={saving === 'archive'}>
              {classroom.archived ? <ArchiveRestore /> : <Archive />}
              {classroom.archived ? 'Restore' : 'Archive'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-semibold text-rose-700">Delete class</p>
              <p className="text-xs text-slate-500">Permanently deletes attendance, marks, resources and notices.</p>
            </div>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Delete
            </Button>
          </div>
        </CardBody>
      </Card>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this class permanently?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} loading={saving === 'delete'} disabled={confirmText.trim() !== classroom.title}>
              Delete forever
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This cannot be undone. Type <b className="text-slate-900">{classroom.title}</b> to confirm.
        </p>
        <Input className="mt-3" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={classroom.title} />
      </Dialog>
    </div>
  );
}
