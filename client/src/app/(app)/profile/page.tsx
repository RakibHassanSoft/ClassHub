'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, KeyRound, LogOut, Save, UserRound } from 'lucide-react';
import { PushCard } from '@/components/layout/push-card';
import { closeSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-store';
import { errorMessage, patch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { InstallButton } from '@/components/layout/install-button';
import type { User } from '@/lib/types';

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: user?.name ?? '',
    institution: user?.institution ?? '',
    department: user?.department ?? '',
    phone: user?.phone ?? '',
    email: user?.email ?? '',
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState<string | null>(null);

  if (!user) return null;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving('profile');
    try {
      const res = await patch<User>('/users/me', form);
      setUser(res.data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSaving('password');
    try {
      await patch('/users/me/password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const signOut = () => {
    closeSocket();
    logout();
    qc.clear();
    router.replace('/login');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="overflow-hidden">
        <div className="from-brand-500 h-24 bg-gradient-to-r to-teal-600" />
        <div className="-mt-10 flex flex-wrap items-end justify-between gap-4 px-6 pb-6">
          <div className="flex items-end gap-4">
            <Avatar name={user.name} src={user.avatar} size="lg" className="size-20 text-2xl ring-4" />
            <div className="pb-1">
              <h1 className="text-xl font-extrabold">{user.name}</h1>
              <p className="text-sm text-slate-500">
                {user.role === 'student' ? `Register ID ${user.studentId ?? ''} · ` : ''}
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex gap-2 pb-1">
            <Badge color={user.role === 'teacher' ? 'emerald' : user.role === 'admin' ? 'violet' : 'sky'} className="capitalize">
              {user.role}
            </Badge>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Personal information" icon={<UserRound />} />
        <CardBody>
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Full name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Institution">
                <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
              </Field>
              <Field label="Department">
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </Field>
            </div>
            <Field label="Gmail" hint="You log in with this email.">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            {user.role === 'teacher' && user.employeeId && (
              <Field label="Employee ID" hint="Checked by the admin. Contact the admin to change it.">
                <Input value={user.employeeId} disabled />
              </Field>
            )}
            {user.role === 'student' && (
              <Field label="Register ID" hint="It links you to your classes. It cannot be changed here.">
                <Input value={user.studentId ?? ''} disabled />
              </Field>
            )}
            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'profile'}>
                <Save /> Save
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notifications" description="Phone and desktop alerts for notices and private messages." icon={<Bell />} />
        <CardBody>
          <PushCard />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Change password" icon={<KeyRound />} />
        <CardBody>
          <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
            <Field label="Current password">
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={pw.currentPassword}
                onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
              />
            </Field>
            <Field label="New password" hint="At least 6 characters">
              <Input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={pw.newPassword}
                onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              />
            </Field>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" variant="outline" loading={saving === 'password'}>
                Update password
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <InstallButton variant="banner" />
        <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={signOut}>
          <LogOut /> Log out
        </Button>
      </div>
    </div>
  );
}
