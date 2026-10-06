'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Crown, Mail, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { usePeople } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, Spinner } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { del, errorMessage, post } from '@/lib/api';
import type { Classroom } from '@/lib/types';

/** Owner adds or removes co-teachers; everyone sees who teaches and who the class representatives are. */
export const TeachersCard = ({ classroom }: { classroom: Classroom }) => {
  const qc = useQueryClient();
  const { data, isLoading } = usePeople(classroom._id);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<{ _id: string; name: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['class', classroom._id, 'people'] });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await post(`/classes/${classroom._id}/teachers`, { email });
      toast.success(res.message);
      setEmail('');
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await del(`/classes/${classroom._id}/teachers/${removing._id}`);
      toast.success(`${removing.name} was removed`);
      setRemoving(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Teachers & representatives"
        description="Co-teachers can do everything except delete the class. Class representatives can post notices and write in teacher-only chat."
        icon={<Users />}
      />
      <CardBody className="space-y-5">
        {isLoading || !data ? (
          <Spinner />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {data.teachers.map((t) => (
                <li key={t._id} className="flex items-center gap-3 p-3.5">
                  <Avatar name={t.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{t.name}</p>
                    <p className="truncate text-xs text-slate-500">{t.email}</p>
                  </div>
                  {t.isOwner ? (
                    <Badge color="amber">
                      <Crown /> Owner
                    </Badge>
                  ) : (
                    <>
                      <Badge color="emerald">Co-teacher</Badge>
                      {classroom.isOwner && (
                        <button
                          type="button"
                          onClick={() => setRemoving(t)}
                          className="grid size-8 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Remove ${t.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
              {data.representatives.map((r) => (
                <li key={r._id} className="flex items-center gap-3 p-3.5">
                  <Avatar name={r.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{r.name}</p>
                    <p className="truncate font-mono text-xs text-slate-500">{r.studentId}</p>
                  </div>
                  <Badge color="sky">Class representative</Badge>
                </li>
              ))}
            </ul>
            {classroom.isOwner ? (
              <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                  <Input
                    type="email"
                    required
                    placeholder="Co-teacher's ClassHub email"
                    icon={<Mail />}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" loading={busy}>
                  <UserPlus /> Add co-teacher
                </Button>
              </form>
            ) : (
              <p className="text-xs text-slate-500">Only the class owner can add or remove teachers.</p>
            )}
            <p className="text-xs text-slate-500">
              To choose class representatives, open the Students tab and use the menu next to a joined student.
            </p>
          </>
        )}
      </CardBody>
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        loading={busy}
        title={`Remove ${removing?.name}?`}
        description="They will lose access to this class."
        confirmLabel="Remove"
      />
    </Card>
  );
};
