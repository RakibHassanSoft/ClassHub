'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FolderOpen, Info, Link2, Pencil, Pin, PinOff, Plus, Search, StickyNote, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useClassContext } from '@/components/class/class-context';
import { AttachmentList, FilePicker, fromAttachments, uploadingCount, type PendingFile } from '@/components/files/attachments';
import { qk, useResources } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { Menu } from '@/components/ui/menu';
import { del, errorMessage, patch, post } from '@/lib/api';
import { DRIVE_META, detectDriveType, resourceMeta } from '@/lib/meta';
import { cn, timeAgo } from '@/lib/utils';
import type { Resource } from '@/lib/types';

const empty = { kind: 'file' as 'link' | 'note' | 'file', title: '', url: '', topic: '', description: '', pinned: false };

/** Materials library: uploaded files, Google Drive links and notes, grouped by topic. */
export function MaterialsView({ autoOpen = false }: { autoOpen?: boolean }) {
  const { classroom, isTeacher } = useClassContext();
  const id = classroom._id;
  const qc = useQueryClient();
  const { data, isLoading } = useResources(id);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string>('all');
  const [open, setOpen] = useState(autoOpen);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState(empty);
  const [deleting, setDeleting] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);

  const topics = useMemo(() => [...new Set((data ?? []).map((r) => r.topic || 'General'))].sort(), [data]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = (data ?? []).filter(
      (r) =>
        (topic === 'all' || (r.topic || 'General') === topic) &&
        (!term || [r.title, r.description, r.topic].some((v) => v?.toLowerCase().includes(term))),
    );
    const pinned = filtered.filter((r) => r.pinned);
    const map = new Map<string, Resource[]>();
    filtered
      .filter((r) => !r.pinned)
      .forEach((r) => {
        const t = r.topic || 'General';
        map.set(t, [...(map.get(t) ?? []), r]);
      });
    return { pinned, byTopic: [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })) };
  }, [data, q, topic]);

  const detected = form.kind === 'link' ? detectDriveType(form.url) : null;

  const refresh = () => qc.invalidateQueries({ queryKey: qk.resources(id) });

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty, topic: topic !== 'all' ? topic : '' });
    setFiles([]);
    setOpen(true);
  };
  const openEdit = (r: Resource) => {
    setEditing(r);
    setForm({
      kind: r.kind === 'note' ? 'note' : r.kind === 'file' ? 'file' : 'link',
      title: r.title,
      url: r.url ?? '',
      topic: r.topic ?? '',
      description: r.description ?? '',
      pinned: r.pinned,
    });
    setFiles(fromAttachments(r.attachments));
    setOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.kind === 'file' && (uploadingCount(files) || !files.length)) {
      toast.error(files.length ? 'Wait for the files to finish uploading' : 'Choose at least one file');
      return;
    }
    setBusy(true);
    const body = {
      kind: form.kind,
      title: form.title.trim(),
      url: form.kind === 'link' ? form.url.trim() : undefined,
      attachmentIds: form.kind === 'file' && !editing ? files.filter((f) => f.id).map((f) => f.id!) : undefined,
      topic: form.topic.trim() || 'General',
      description: form.description.trim() || undefined,
      pinned: form.pinned,
    };
    try {
      if (editing) await patch(`/classes/${id}/resources/${editing._id}`, body);
      else await post(`/classes/${id}/resources`, body);
      toast.success(editing ? 'Resource updated' : 'Resource shared with your class');
      setOpen(false);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async (r: Resource) => {
    try {
      await patch(`/classes/${id}/resources/${r._id}`, { pinned: !r.pinned });
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await del(`/classes/${id}/resources/${deleting._id}`);
      toast.success('Resource removed');
      setDeleting(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const ResourceItem = ({ r }: { r: Resource }) => {
    const meta = resourceMeta(r);
    const inner = (
      <>
        <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl ring-1 [&_svg]:size-5', meta.tone)}>{meta.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="group-hover:text-brand-700 line-clamp-2 font-semibold text-slate-800">{r.title}</p>
            {r.pinned && <Pin className="mt-1 size-3.5 shrink-0 text-amber-500" />}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {meta.label} · {timeAgo(r.createdAt)}
          </p>
          {r.description && <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line text-slate-600">{r.description}</p>}
          {r.kind === 'file' && r.attachments && r.attachments.length > 0 && (
            <div className="mt-3">
              <AttachmentList items={r.attachments} compact />
            </div>
          )}
        </div>
      </>
    );
    return (
      <div className="group shadow-soft hover:shadow-card relative flex gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:-translate-y-0.5">
        {r.url ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 gap-3.5">
            {inner}
            <ExternalLink className="group-hover:text-brand-500 mt-1 size-4 shrink-0 text-slate-300" />
          </a>
        ) : (
          <div className="flex min-w-0 flex-1 gap-3.5">{inner}</div>
        )}
        {isTeacher && (
          <Menu
            items={[
              { label: r.pinned ? 'Unpin' : 'Pin to top', icon: r.pinned ? <PinOff /> : <Pin />, onClick: () => togglePin(r) },
              { label: 'Edit', icon: <Pencil />, onClick: () => openEdit(r) },
              { label: 'Delete', icon: <Trash2 />, onClick: () => setDeleting(r), danger: true },
            ]}
          />
        )}
      </div>
    );
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Materials</h2>
          <p className="text-sm text-slate-500">Lecture files, slides, ZIPs, Google Drive links and notes</p>
        </div>
        {isTeacher && (
          <Button onClick={openNew}>
            <Plus /> Add material
          </Button>
        )}
      </div>

      {data && data.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="-mx-4 flex scrollbar-thin gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {['all', ...topics].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className={cn(
                  'cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ring-1 transition',
                  topic === t ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300',
                )}
              >
                {t === 'all' ? 'All topics' : t}
              </button>
            ))}
          </div>
          <div className="sm:w-64">
            <Input placeholder="Search resources" icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      )}

      {!data?.length ? (
        <Card>
          <EmptyState
            icon={<FolderOpen />}
            title="No materials yet"
            description={
              isTeacher
                ? 'Share a Google Drive folder or file link. Make sure sharing is set to “Anyone with the link” so students can open it.'
                : 'Your teacher has not shared any materials yet.'
            }
            action={
              isTeacher && (
                <Button onClick={openNew}>
                  <Plus /> Add first resource
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-7">
          {groups.pinned.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
                <Pin className="size-4 text-amber-500" /> Pinned
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {groups.pinned.map((r) => (
                  <ResourceItem key={r._id} r={r} />
                ))}
              </div>
            </section>
          )}
          {groups.byTopic.map(([t, items]) => (
            <section key={t}>
              <h3 className="mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">
                {t} <span className="font-medium text-slate-400">· {items.length}</span>
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map((r) => (
                  <ResourceItem key={r._id} r={r} />
                ))}
              </div>
            </section>
          ))}
          {groups.pinned.length === 0 && groups.byTopic.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">Nothing matches your search.</p>
          )}
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit resource' : 'Share a resource'}
        icon={<FolderOpen />}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="resource-form" loading={busy}>
              {editing ? 'Save' : 'Share'}
            </Button>
          </>
        }
      >
        <form id="resource-form" onSubmit={submit} className="space-y-4">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {(
              [
                ['file', 'Upload files', <Upload key="u" className="size-4" />],
                ['link', 'Drive / link', <Link2 key="l" className="size-4" />],
                ['note', 'Text note', <StickyNote key="n" className="size-4" />],
              ] as const
            ).map(([k, label, icon]) => (
              <button
                key={k}
                type="button"
                onClick={() => setForm({ ...form, kind: k })}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition',
                  form.kind === k ? 'shadow-soft bg-white text-slate-900' : 'text-slate-500',
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {form.kind === 'file' && !editing && (
            <Field label="Files" required>
              <FilePicker classId={id} value={files} onChange={setFiles} />
            </Field>
          )}
          {form.kind === 'link' && (
            <Field
              label="Google Drive link"
              required
              hint={
                detected ? (
                  <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <span className="[&_svg]:size-3.5">{DRIVE_META[detected].icon}</span> Detected: {DRIVE_META[detected].label}
                  </span>
                ) : (
                  'Paste a Drive folder/file, Docs, Sheets, Slides, Forms or any other link.'
                )
              }
            >
              <Input
                type="url"
                required
                placeholder="https://drive.google.com/drive/folders/…"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </Field>
          )}
          <Field label="Title" required>
            <Input
              required
              placeholder="e.g. Week 3 lecture slides"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Topic / week" hint="Resources are grouped by topic.">
            <Input
              list="topic-options"
              placeholder="e.g. Week 3, Mid-term, Lab"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
            <datalist id="topic-options">
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label={form.kind === 'note' ? 'Note' : 'Description'} required={form.kind === 'note'}>
            <Textarea
              required={form.kind === 'note'}
              placeholder={form.kind === 'note' ? 'Write your note…' : 'Optional'}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="size-4 accent-emerald-600"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            Pin to top
          </label>
          {form.kind === 'link' && detected && (
            <div className="flex gap-2.5 rounded-xl bg-sky-50 p-3 text-xs text-sky-800 ring-1 ring-sky-100">
              <Info className="mt-0.5 size-4 shrink-0" />
              In Google Drive, set sharing to <b>&nbsp;Anyone with the link → Viewer&nbsp;</b> so students can open it.
            </div>
          )}
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title="Remove this resource?"
        description="The file stays in your Google Drive; only the link is removed from the class."
        confirmLabel="Remove"
      />
    </div>
  );
}
