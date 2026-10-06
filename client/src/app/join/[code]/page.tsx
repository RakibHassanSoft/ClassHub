'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, IdCard, Lock, ShieldCheck, TriangleAlert, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/misc';
import { errorMessage, get, post } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { coverGradient, tone } from '@/lib/colors';
import { qk } from '@/hooks/queries';
import { cn } from '@/lib/utils';

interface Preview {
  _id: string;
  title: string;
  courseCode?: string;
  section?: string;
  semester?: string;
  color: string;
  teacher?: string;
  joinEnabled: boolean;
  alreadyMember: boolean;
  you: { name: string; studentId?: string; role: 'teacher' | 'student' };
  onList: boolean;
  canJoin: boolean;
}

/** Opened from a class code, invite link or QR scan. The register ID comes from the account. */
export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { token, user, hydrated, logout } = useAuth();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hydrated && !token) router.replace(`/register?next=${encodeURIComponent(`/join/${code}`)}`);
  }, [hydrated, token, code, router]);

  const {
    data,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['join', code],
    queryFn: () => get<Preview>(`/classes/join/${code}`),
    enabled: hydrated && Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (data?.alreadyMember) router.replace(`/classes/${data._id}`);
  }, [data, router]);

  const join = async () => {
    setError('');
    setJoining(true);
    try {
      const res = await post<{ classId: string }>(`/classes/join/${code}`);
      toast.success(`Welcome to ${data?.title}!`);
      await qc.invalidateQueries({ queryKey: qk.classes });
      router.replace(`/classes/${res.data.classId}`);
    } catch (err) {
      setError(errorMessage(err));
      setJoining(false);
    }
  };

  const switchAccount = (to: 'login' | 'register') => {
    logout();
    router.replace(`/${to}?next=${encodeURIComponent(`/join/${code}`)}`);
  };

  if (!hydrated || !token || isLoading || data?.alreadyMember) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <PageLoader label="Opening class…" />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-50">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_65%)]" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
        <Logo href="/dashboard" />
        <div className="animate-pop-in my-auto py-10">
          {loadError || !data ? (
            <div className="shadow-card rounded-3xl border border-slate-200 bg-white p-8 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                <TriangleAlert className="size-7" />
              </div>
              <h1 className="mt-5 text-xl font-bold">Class not found</h1>
              <p className="mt-2 text-sm text-slate-500">{errorMessage(loadError, 'Check the class code and try again.')}</p>
              <Link href="/classes">
                <Button variant="outline" className="mt-6">
                  Try another code
                </Button>
              </Link>
            </div>
          ) : (
            <div className="shadow-lift overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className={cn('relative bg-gradient-to-br p-7 text-white', tone(coverGradient, data.color))}>
                <div className="absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
                <p className="relative text-xs font-bold tracking-wider text-white/80 uppercase">Join class</p>
                <h1 className="font-display relative mt-2 text-2xl font-extrabold text-white">{data.title}</h1>
                <p className="relative mt-1 text-sm text-white/85">
                  {[data.courseCode, data.section && `Section ${data.section}`, data.semester].filter(Boolean).join(' · ')}
                </p>
                {data.teacher && <p className="relative mt-4 text-sm font-semibold">Teacher: {data.teacher}</p>}
              </div>

              <div className="space-y-4 p-7">
                {data.you.role !== 'student' ? (
                  <>
                    <div className="flex gap-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-800 ring-1 ring-sky-200">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                      You are logged in as a teacher. Students join with their own student account.
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => switchAccount('login')}>
                      Log in as a student
                    </Button>
                  </>
                ) : !data.joinEnabled ? (
                  <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
                    <Lock className="mt-0.5 size-4 shrink-0" />
                    Joining is turned off for this class right now. Ask your teacher to turn it on.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                      <div className="text-brand-600 shadow-soft grid size-10 shrink-0 place-items-center rounded-xl bg-white">
                        <IdCard className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{data.you.name}</p>
                        <p className="font-mono text-sm text-slate-600">{data.you.studentId}</p>
                      </div>
                    </div>

                    {data.canJoin ? (
                      <>
                        <Button size="lg" className="w-full" onClick={join} loading={joining}>
                          Join class <ArrowRight />
                        </Button>
                        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                          <ShieldCheck className="text-brand-600 size-3.5" />
                          Your register ID is on the class list
                        </p>
                      </>
                    ) : (
                      <div className="flex gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">
                        <UserX className="mt-0.5 size-4 shrink-0" />
                        <span>
                          Your register ID is not on this class list yet. Ask <b>{data.teacher ?? 'your teacher'}</b> to add{' '}
                          <b className="font-mono">{data.you.studentId}</b>, then open this code again.
                        </span>
                      </div>
                    )}
                    {error && (
                      <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">{error}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-slate-400">
          Signed in as {user?.name} ·{' '}
          <button type="button" className="cursor-pointer font-semibold text-slate-500 underline" onClick={() => switchAccount('login')}>
            switch account
          </button>
        </p>
      </div>
    </div>
  );
}
