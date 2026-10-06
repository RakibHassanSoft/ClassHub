'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import { get } from '@/lib/api';
import type { User } from '@/lib/types';
import { AppShell } from '@/components/layout/app-shell';
import { PageLoader } from '@/components/ui/misc';
import { TeacherPending } from '@/components/admin/teacher-pending';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { token, hydrated, loggedOut, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // refresh the saved profile once (role / approval status may have changed)
  const setUser = useAuth((s) => s.setUser);
  useEffect(() => {
    if (!hydrated || !token) return;
    get<User>('/users/me')
      .then(setUser)
      .catch(() => undefined);
  }, [hydrated, token, setUser]);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace(loggedOut ? '/login' : `/login?next=${encodeURIComponent(pathname + window.location.search)}`);
    }
  }, [hydrated, token, router, pathname, loggedOut]);

  if (!hydrated || !token) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <PageLoader />
      </div>
    );
  }

  // teachers wait here until an admin approves them
  if (user?.role === 'teacher' && user.teacherStatus && user.teacherStatus !== 'approved') return <TeacherPending user={user} />;

  return <AppShell>{children}</AppShell>;
}
