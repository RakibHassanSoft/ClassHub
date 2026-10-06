'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AtSign, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { errorMessage, post } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import type { User } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuth((s) => s.setAuth);
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await post<{ token: string; user: User }>('/auth/login', form);
      setAuth(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name.split(' ')[0]}!`);
      router.replace(safeNext ?? (res.data.user.role === 'admin' ? '/admin' : '/dashboard'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-3xl font-extrabold">Welcome back</h1>
      <p className="mt-2 text-slate-500">Log in to see your classes.</p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Gmail or register ID" htmlFor="identifier" hint="Teachers: your Gmail. Students: your Gmail or register ID.">
          <Input
            id="identifier"
            autoComplete="username"
            autoCapitalize="none"
            required
            placeholder="you@gmail.com or CSE-2201-045"
            icon={<AtSign />}
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            icon={<Lock />}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Log in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        New to ClassHub?{' '}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-brand-600 hover:text-brand-700 font-semibold">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
