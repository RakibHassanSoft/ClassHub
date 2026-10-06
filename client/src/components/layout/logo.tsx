'use client';

import { useId } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const LogoMark = ({ className }: { className?: string }) => {
  // unique id: the same logo can appear twice (e.g. hidden sidebar + header)
  const gid = `lg-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9 drop-shadow-sm', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <path d="M14 22.5c6-2.6 12-2.6 18 1v21c-6-3.6-12-3.6-18-1z" fill="#fff" fillOpacity=".95" />
      <path d="M50 22.5c-6-2.6-12-2.6-18 1v21c6-3.6 12-3.6 18-1z" fill="#fff" fillOpacity=".75" />
      <path d="M37.5 33.5l3.5 3.5 6-7" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const Logo = ({ href = '/', className }: { href?: string; className?: string }) => (
  <Link href={href} className={cn('flex items-center gap-2.5', className)}>
    <LogoMark />
    <span className="font-display text-[19px] font-extrabold tracking-tight text-slate-900">
      Class<span className="text-brand-600">Hub</span>
    </span>
  </Link>
);
