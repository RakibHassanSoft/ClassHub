import Link from 'next/link';
import { Logo } from '@/components/layout/logo';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-50 px-6">
      <div className="text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <p className="font-display text-brand-100 mt-10 text-7xl font-extrabold">404</p>
        <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-slate-500">The page you are looking for does not exist or was moved.</p>
        <Link
          href="/dashboard"
          className="from-brand-500 to-brand-600 shadow-brand mt-6 inline-flex h-11 items-center rounded-xl bg-gradient-to-b px-5 text-sm font-semibold text-white"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
