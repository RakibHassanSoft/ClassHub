import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "In short" box with the AI summary of a long message or notice. */
export const AiSummary = ({ text, className }: { text?: string | null; className?: string }) => {
  if (!text) return null;
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-br from-violet-50 to-sky-50 px-3 py-2 text-[13px] leading-snug text-slate-700 ring-1 ring-violet-100',
        className,
      )}
    >
      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold tracking-wider text-violet-600 uppercase">
        <Sparkles className="size-3" /> In short · AI
      </p>
      {text}
    </div>
  );
};
