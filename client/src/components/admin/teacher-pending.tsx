'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, LogOut, RefreshCw, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { closeSocket } from '@/lib/socket';
import type { User } from '@/lib/types';

/** Shown to a teacher until an admin approves the account (checks again every 30 seconds). */
export const TeacherPending = ({ user }: { user: User }) => {
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const router = useRouter();
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const rejected = user.teacherStatus === 'rejected';

  const check = async (manual = false) => {
    if (manual) setChecking(true);
    try {
      const me = await get<User>('/users/me');
      setUser(me);
      if (me.teacherStatus === 'approved') toast.success('Your account is approved. Welcome to ClassHub!');
      else if (manual) toast.info(me.teacherStatus === 'rejected' ? 'Your account was not approved' : 'Still waiting for the admin');
    } catch {
      /* offline */
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const t = setInterval(() => check(), 30_000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = () => {
    closeSocket();
    logout();
    qc.clear();
    router.replace('/login');
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="shadow-card rounded-3xl border border-slate-200 bg-white p-7 text-center">
          <span
            className={`mx-auto grid size-14 place-items-center rounded-2xl ${rejected ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}
          >
            {rejected ? <ShieldX className="size-7" /> : <Clock className="size-7" />}
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">{rejected ? 'Account not approved' : 'Waiting for verification'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {rejected
              ? 'The admin could not verify your teacher account.'
              : 'An admin is checking your teacher details. You can create classes as soon as you are approved — this page updates by itself.'}
          </p>
          {rejected && user.reviewNote && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">Reason: {user.reviewNote}</p>
          )}
          <dl className="mt-6 space-y-2 rounded-2xl bg-slate-50 p-4 text-left text-sm ring-1 ring-slate-200">
            {(
              [
                ['Name', user.name],
                ['Gmail', user.email],
                ['Employee ID', user.employeeId],
                ['Department', user.department],
                ['Institution', user.institution],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="truncate font-semibold text-slate-800">{v}</dd>
                </div>
              ))}
          </dl>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => check(true)} loading={checking}>
              <RefreshCw /> Check again
            </Button>
            <Button variant="outline" className="flex-1" onClick={signOut}>
              <LogOut /> Log out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
