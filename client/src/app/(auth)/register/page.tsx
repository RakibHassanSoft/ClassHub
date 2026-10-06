'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AtSign, BadgeCheck, BookOpen, Building2, GraduationCap, IdCard, Lock, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { errorMessage, post } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import type { Role, User } from '@/lib/types';

const empty = { name: '', email: '', password: '', studentId: '', employeeId: '', department: '', institution: '' };

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuth((s) => s.setAuth);
  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  const [role, setRole] = useState<Role>('student');
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const common = { name: form.name.trim(), email: form.email.trim(), password: form.password, institution: form.institution.trim() || undefined };
    const body =
      role === 'student'
        ? { ...common, role, studentId: form.studentId.trim(), department: form.department.trim() || undefined }
        : { ...common, role, employeeId: form.employeeId.trim(), department: form.department.trim() };
    try {
      const res = await post<{ token: string; user: User }>('/auth/register', body);
      setAuth(res.data.token, res.data.user);
      toast.success(res.data.user.teacherStatus === 'pending' ? 'Account created — waiting for admin verification' : 'Account created. Welcome!');
      router.replace(safeNext);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-extrabold">Create your account</h1>
      <p className="mt-2 text-slate-500">Sign up with your Gmail and a password.</p>

      <div className="mt-7 grid grid-cols-2 gap-3" role="radiogroup" aria-label="I am a">
        {(
          [
            ['student', 'Student', 'Join classes with your register ID', GraduationCap],
            ['teacher', 'Teacher', 'Verified by the admin', BookOpen],
          ] as const
        ).map(([value, title, hint, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={role === value}
            onClick={() => {
              setRole(value);
              setError('');
            }}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 text-left ring-1 transition',
              role === value ? 'bg-brand-50 ring-brand-500 ring-2' : 'bg-white ring-slate-200 hover:ring-slate-300',
            )}
          >
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', role === value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500')}>
              <Icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-900">{title}</span>
              <span className="block text-[11px] leading-tight text-slate-500">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Full name" htmlFor="name" required>
          <Input id="name" autoComplete="name" required minLength={2} maxLength={80} placeholder="As on university records" icon={<UserRound />} value={form.name} onChange={set('name')} />
        </Field>

        {role === 'student' ? (
          <Field label="Register ID" htmlFor="studentId" required hint="Your teacher adds this ID to the class list. You can join a class only when it is on the list.">
            <Input id="studentId" required autoCapitalize="characters" placeholder="e.g. CSE-2201-045" icon={<IdCard />} value={form.studentId} onChange={set('studentId')} />
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee / teacher ID" htmlFor="employeeId" required>
              <Input id="employeeId" required autoCapitalize="characters" placeholder="e.g. PU-T-0231" icon={<BadgeCheck />} value={form.employeeId} onChange={set('employeeId')} />
            </Field>
            <Field label="Department" htmlFor="department" required>
              <Input id="department" required minLength={2} placeholder="e.g. CSE" icon={<Building2 />} value={form.department} onChange={set('department')} />
            </Field>
          </div>
        )}

        <Field label="Gmail" htmlFor="email" required>
          <Input id="email" type="email" autoComplete="email" autoCapitalize="none" required placeholder="you@gmail.com" icon={<AtSign />} value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" htmlFor="password" required hint="At least 6 characters">
          <Input id="password" type="password" autoComplete="new-password" required minLength={6} placeholder="••••••••" icon={<Lock />} value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Institution (optional)" htmlFor="institution">
          <Input id="institution" placeholder="e.g. Premier University" value={form.institution} onChange={set('institution')} />
        </Field>

        {role === 'teacher' && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-200">
            After you sign up, an admin checks your employee ID. You can create classes as soon as you are approved — you will get a notification.
          </p>
        )}
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create {role} account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-brand-600 hover:text-brand-700 font-semibold">
          Log in
        </Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
