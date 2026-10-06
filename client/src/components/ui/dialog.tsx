'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useIsClient } from '@/hooks/use-is-client';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: ReactNode;
}

const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

export const Dialog = ({ open, onClose, title, description, children, footer, size = 'md', icon }: DialogProps) => {
  const mounted = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  // keep the latest onClose without re-running the open effect (which would steal focus on every parent render)
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    }, 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        className={cn(
          'animate-slide-up shadow-lift sm:animate-pop-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        {(title || description) && (
          <div className="flex items-start gap-3 border-b border-slate-100 px-5 pt-4 pb-4 sm:px-6 sm:pt-5">
            {icon && (
              <div className="bg-brand-50 text-brand-600 ring-brand-100 grid size-10 shrink-0 place-items-center rounded-xl ring-1 [&_svg]:size-5">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {title && <h2 className="text-lg font-bold">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-2 grid size-9 cursor-pointer place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="flex-1 scrollbar-thin overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  loading,
  tone = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
  tone?: 'danger' | 'primary';
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    footer={
      <>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          'mb-4 grid size-12 place-items-center rounded-full',
          tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-600',
        )}
      >
        <AlertTriangle className="size-6" />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
    </div>
  </Dialog>
);
