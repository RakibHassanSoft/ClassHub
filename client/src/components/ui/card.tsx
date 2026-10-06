import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('shadow-card rounded-2xl border border-slate-200/80 bg-white', className)} {...props} />
);

export const CardHeader = ({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6', className)}>
    <div className="flex min-w-0 items-start gap-3">
      {icon && (
        <div className="bg-brand-50 text-brand-600 ring-brand-100 grid size-10 shrink-0 place-items-center rounded-xl ring-1 [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h3 className="text-base font-bold">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
    </div>
    {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
  </div>
);

export const CardBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-5 sm:p-6', className)} {...props} />
);
