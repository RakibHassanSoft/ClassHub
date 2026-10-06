'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

export const Menu = ({
  items,
  trigger,
  align = 'right',
  className,
}: {
  items: MenuItem[];
  trigger?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="grid size-8 cursor-pointer place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        aria-label="More actions"
        aria-expanded={open}
      >
        {trigger ?? <MoreHorizontal className="size-[18px]" />}
      </button>
      {open && (
        <div
          className={cn(
            'animate-pop-in shadow-lift absolute z-50 mt-1 min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items
            .filter((i) => !i.hidden)
            .map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition [&_svg]:size-4',
                  item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
