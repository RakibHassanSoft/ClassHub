import type { ReactNode } from 'react';
import { CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from '@/components/layout/logo';

const points = [
  {
    icon: ShieldCheck,
    title: 'Only your students join',
    text: 'Students join with a class code or QR; their register ID is checked against your list.',
  },
  { icon: CheckCircle2, title: 'Attendance in seconds', text: 'Pick a date, tap statuses, export to Excel or print.' },
  { icon: Sparkles, title: 'AI class list import', text: 'Upload a PDF of your students — Gemini reads it for you.' },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="from-brand-600 relative hidden overflow-hidden bg-gradient-to-br via-emerald-700 to-teal-800 p-12 text-white lg:flex lg:flex-col">
        <div className="bg-grid absolute inset-0 opacity-[0.15] [filter:invert(1)]" />
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 size-[28rem] rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white/95 px-3 py-2 shadow-lg">
            <Logo />
          </div>
        </div>
        <div className="relative mt-auto max-w-lg">
          <h1 className="font-display text-4xl leading-tight font-extrabold text-white">Run every class from one calm, organised place.</h1>
          <p className="mt-4 text-lg text-emerald-50/85">Attendance, routine, resources, marks and notices — for teachers and students.</p>
          <div className="mt-10 space-y-5">
            {points.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-emerald-50/75">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative mt-12 text-xs text-emerald-50/60">© {new Date().getFullYear()} ClassHub</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="animate-pop-in w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
