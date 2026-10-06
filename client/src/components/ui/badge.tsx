import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { softTone, tone } from '@/lib/colors';

export const Badge = ({ color = 'slate', className, ...props }: HTMLAttributes<HTMLSpanElement> & { color?: string }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset [&_svg]:size-3.5',
      tone(softTone, color),
      className,
    )}
    {...props}
  />
);
