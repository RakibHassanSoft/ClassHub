'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, BookOpen, CalendarDays, LayoutDashboard, LogOut, Menu as MenuIcon, MessagesSquare, ShieldCheck, UserRound, X } from 'lucide-react';
import { useRealtime } from '@/hooks/use-realtime';
import { closeSocket } from '@/lib/socket';
import { useAuth } from '@/lib/auth-store';
import { useClasses, useConversations } from '@/hooks/queries';
import { swatch, tone } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/misc';
import { Menu } from '@/components/ui/menu';
import { Logo } from './logo';
import { InstallButton } from './install-button';
import { NotificationBell } from './notification-bell';
import { OfflineSync } from './offline-sync';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/classes', label: 'My classes', icon: BookOpen },
  { href: '/messages', label: 'Messages', icon: MessagesSquare },
  { href: '/routine', label: 'Routine', icon: CalendarDays },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Admin panel', icon: ShieldCheck },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: UserRound },
];
const ADMIN_PATHS = ADMIN_NAV.map((n) => n.href);

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const pathname = usePathname();
  const isAdmin = useAuth((s) => s.user?.role === 'admin');
  const { data: classes } = useClasses();
  const { data: chats } = useConversations();
  const active = (classes ?? []).filter((c) => !c.archived);
  const nav = isAdmin ? ADMIN_NAV : NAV;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo href="/dashboard" />
      </div>

      <nav className="space-y-0.5 px-3 pt-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/classes' ? pathname === '/classes' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon className={cn('size-[18px]', isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')} />
              {label}
              {href === '/messages' && (chats?.unread ?? 0) > 0 && (
                <span className="bg-brand-500 ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white">
                  {chats!.unread > 99 ? '99+' : chats!.unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn('mt-6 min-h-0 flex-1 px-3', isAdmin && 'invisible')}>
        <p className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">Your classes</p>
        <div className="max-h-full scrollbar-thin space-y-0.5 overflow-y-auto pb-4">
          {active.length === 0 && <p className="px-3 text-xs text-slate-400">No classes yet</p>}
          {active.map((c) => {
            const isActive = pathname.startsWith(`/classes/${c._id}`);
            return (
              <Link
                key={c._id}
                href={`/classes/${c._id}`}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
                  isActive ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <span className={cn('size-2.5 shrink-0 rounded-full', tone(swatch, c.color))} />
                <span className="truncate">{c.courseCode ? `${c.courseCode} · ${c.title}` : c.title}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="p-3">
        <InstallButton />
      </div>
    </div>
  );
};

const MOBILE_NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/classes', label: 'Classes', icon: BookOpen },
  { href: '/messages', label: 'Chats', icon: MessagesSquare },
  { href: '/notifications', label: 'Alerts', icon: Bell },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [drawer, setDrawer] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { data: chats } = useConversations();
  useRealtime();
  const isAdmin = user?.role === 'admin';
  const mobileNav = isAdmin ? ADMIN_NAV.map((n) => ({ ...n, label: n.label.replace(' panel', '') })) : MOBILE_NAV;

  // admins only use the admin panel, notifications and profile
  useEffect(() => {
    if (isAdmin && !ADMIN_PATHS.some((p) => pathname.startsWith(p))) router.replace('/admin');
  }, [isAdmin, pathname, router]);

  const signOut = () => {
    closeSocket();
    logout();
    qc.clear();
    router.replace('/login');
  };

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200/80 bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} />
          <aside className="animate-slide-up shadow-lift absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="absolute top-4 right-3 grid size-9 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="no-print sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                className="grid size-10 cursor-pointer place-items-center rounded-xl text-slate-600 hover:bg-slate-100"
                aria-label="Open menu"
              >
                <MenuIcon className="size-5" />
              </button>
              <Logo href="/dashboard" />
            </div>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-1.5">
              <InstallButton variant="banner" />
              <NotificationBell />
              <Menu
                trigger={
                  <span className="flex items-center gap-2.5">
                    <Avatar name={user?.name} src={user?.avatar} size="sm" />
                  </span>
                }
                items={[
                  { label: 'Profile', icon: <UserRound />, onClick: () => router.push('/profile') },
                  { label: 'Log out', icon: <LogOut />, onClick: signOut, danger: true },
                ]}
                className="[&>button]:size-10 [&>button]:rounded-full"
              />
            </div>
          </div>
        </header>
        <OfflineSync />

        <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className={cn('grid', isAdmin ? 'grid-cols-3' : 'grid-cols-5')}>
          {mobileNav.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/classes' || href === '/messages' || href === '/admin' ? pathname.startsWith(href) : pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition',
                  isActive ? 'text-brand-600' : 'text-slate-500',
                )}
              >
                <span className={cn('relative grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-50')}>
                  <Icon className="size-5" />
                  {href === '/messages' && (chats?.unread ?? 0) > 0 && (
                    <span className="absolute -top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                      {chats!.unread > 9 ? '9+' : chats!.unread}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
