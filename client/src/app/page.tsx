'use client';

import Link from 'next/link';
import { useIsClient } from '@/hooks/use-is-client';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  Link2,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: ShieldCheck,
    title: 'Verified joining',
    text: 'Like Google Classroom: share a class code or QR. Only register IDs on your class list get in.',
  },
  {
    icon: ClipboardCheck,
    title: 'Flexible attendance',
    text: 'Add a date, tap Present / Absent / Late, edit any day later. Export to Excel or print.',
  },
  { icon: Sparkles, title: 'AI class list', text: 'Upload the PDF your department gave you. Gemini turns it into a clean, editable list.' },
  {
    icon: CalendarDays,
    title: 'Weekly routine',
    text: 'Set class times once. Students see a combined timetable across all their courses.',
  },
  {
    icon: FolderOpen,
    title: 'Google Drive resources',
    text: 'Paste Drive folder or file links, group them by week or topic. Zero storage cost.',
  },
  {
    icon: GraduationCap,
    title: 'Private marks',
    text: 'Grade sheet with weights. Publish when ready — each student sees only their own marks.',
  },
  {
    icon: Bell,
    title: 'Instant notices',
    text: 'Class cancelled? Room changed? Post it and every student gets it in their notification bell.',
  },
  { icon: Smartphone, title: 'Installable app', text: 'Works in any browser and installs to the phone home screen with one tap.' },
];

const steps = [
  { n: '01', title: 'Create a class', text: 'Course code, section, semester — done in 20 seconds.' },
  { n: '02', title: 'Add your students', text: 'Upload a PDF, CSV or Excel file, or type them in.' },
  { n: '03', title: 'Share the code', text: 'Students sign up with Gmail and their register ID, then type the class code or scan the QR.' },
];

const demoRows = [
  { id: 'CSE-221-001', name: 'Ayesha Rahman', s: 'P' },
  { id: 'CSE-221-002', name: 'Tanvir Ahmed', s: 'P' },
  { id: 'CSE-221-003', name: 'Nusrat Jahan', s: 'L' },
  { id: 'CSE-221-004', name: 'Rafiul Islam', s: 'A' },
  { id: 'CSE-221-005', name: 'Mehedi Hasan', s: 'P' },
];

const chip: Record<string, string> = {
  P: 'bg-emerald-500 text-white',
  A: 'bg-rose-500 text-white',
  L: 'bg-amber-500 text-white',
};

export default function Landing() {
  const token = useAuth((s) => s.token);
  const ready = useIsClient();
  const loggedIn = ready && Boolean(token);

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-2">
            {loggedIn ? (
              <Link href="/dashboard">
                <Button>
                  Open dashboard <ArrowRight />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden sm:block">
                  <Button variant="ghost">Log in</Button>
                </Link>
                <Link href="/register">
                  <Button>Get started free</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
        <div className="absolute top-[-10rem] left-1/2 h-[32rem] w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-200/50 via-teal-200/40 to-cyan-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-16 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-24 lg:pb-28">
          <div className="animate-slide-up">
            <span className="border-brand-200 text-brand-700 shadow-soft inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-xs font-semibold">
              <Sparkles className="size-3.5" /> AI-powered class list import
            </span>
            <h1 className="mt-6 text-4xl leading-[1.1] font-extrabold sm:text-5xl lg:text-[56px]">
              Your classroom,{' '}
              <span className="from-brand-600 bg-gradient-to-r to-teal-600 bg-clip-text text-transparent">beautifully organised.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Attendance, routine, Google Drive resources, marks and instant notices — in one place your students can install on their
              phones.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={loggedIn ? '/dashboard' : '/register'}>
                <Button size="lg">
                  {loggedIn ? 'Go to dashboard' : 'Create a free account'} <ArrowRight />
                </Button>
              </Link>
              {!loggedIn && (
                <Link href="/login">
                  <Button size="lg" variant="outline">
                    I already have an account
                  </Button>
                </Link>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              {['Free to use', 'Works on any phone', 'No app store needed'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="text-brand-600 size-4" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Product preview */}
          <div className="animate-pop-in relative">
            <div className="from-brand-200/50 absolute -inset-4 rounded-[2rem] bg-gradient-to-br to-teal-200/40 blur-2xl" />
            <div className="shadow-lift relative overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5 text-white">
                <p className="text-xs font-semibold tracking-wide text-white/75 uppercase">CSE-221 · Section A</p>
                <p className="font-display mt-1 text-xl font-bold">Data Structures</p>
                <div className="mt-4 flex gap-2 text-xs">
                  <span className="rounded-full bg-white/20 px-2.5 py-1 font-semibold">Attendance · 6 Oct</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">42 students</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {demoRows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.id}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {['P', 'A', 'L'].map((k) => (
                        <span
                          key={k}
                          className={cn(
                            'grid size-8 place-items-center rounded-lg text-xs font-bold',
                            r.s === k ? chip[k] : 'bg-slate-100 text-slate-400',
                          )}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between bg-slate-50 px-5 py-3 text-xs">
                <span className="font-semibold text-slate-600">
                  <span className="text-emerald-600">38 present</span> · <span className="text-rose-600">3 absent</span> ·{' '}
                  <span className="text-amber-600">1 late</span>
                </span>
                <span className="bg-brand-600 rounded-lg px-3 py-1.5 font-semibold text-white">Save</span>
              </div>
            </div>
            <div className="shadow-lift absolute -bottom-6 -left-6 hidden w-60 rounded-2xl border border-slate-200 bg-white p-4 sm:block">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-rose-50 text-rose-600">
                  <Bell className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Class cancelled</p>
                  <p className="text-xs text-slate-500">Sent to 42 students</p>
                </div>
              </div>
            </div>
            <div className="shadow-lift absolute -top-5 -right-4 hidden w-52 rounded-2xl border border-slate-200 bg-white p-4 sm:block">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
                  <Link2 className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Week 5 slides</p>
                  <p className="text-xs text-slate-500">Google Drive folder</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-100 bg-slate-50/70 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-brand-600 text-sm font-bold tracking-wide uppercase">Everything a class needs</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Built for real teachers and real classrooms</h2>
            <p className="mt-4 text-slate-600">
              Customise statuses, assessments, colours and visibility for each class — ClassHub adapts to how you teach.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="group shadow-soft hover:shadow-card rounded-2xl border border-slate-200/80 bg-white p-6 transition hover:-translate-y-0.5"
              >
                <div className="from-brand-50 text-brand-600 ring-brand-100 group-hover:from-brand-500 grid size-11 place-items-center rounded-xl bg-gradient-to-br to-teal-50 ring-1 transition group-hover:to-teal-600 group-hover:text-white">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 text-[15px] font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Up and running in three steps</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="shadow-soft relative rounded-2xl border border-slate-200 bg-white p-7">
                <span className="font-display text-brand-100 text-5xl font-extrabold">{s.n}</span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20">
        <div className="from-brand-600 relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br via-emerald-700 to-teal-800 px-8 py-14 text-center text-white sm:px-16">
          <div className="bg-grid absolute inset-0 opacity-20 [filter:invert(1)]" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Start your first class today</h2>
            <p className="mx-auto mt-4 max-w-xl text-emerald-50/85">Free for teachers and students. Set up takes less than five minutes.</p>
            <Link href={loggedIn ? '/dashboard' : '/register'}>
              <Button size="lg" variant="outline" className="text-brand-700 mt-8 border-0">
                {loggedIn ? 'Open dashboard' : 'Create a free account'} <ArrowRight />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-slate-500 sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} ClassHub. Made for teachers.</p>
        </div>
      </footer>
    </div>
  );
}
