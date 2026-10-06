'use client';

import { CalendarDays } from 'lucide-react';
import { WeekView } from '@/components/class/week-view';
import { useMyWeek } from '@/hooks/queries';
import { Card } from '@/components/ui/card';
import { EmptyState, PageLoader } from '@/components/ui/misc';

export default function MyRoutinePage() {
  const { data, isLoading } = useMyWeek();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">My routine</h1>
        <p className="mt-1 text-slate-500">Every class you are part of, in one weekly view.</p>
      </div>
      {isLoading ? (
        <PageLoader />
      ) : !data?.length ? (
        <Card>
          <EmptyState
            icon={<CalendarDays />}
            title="Your week is empty"
            description="Class times appear here once teachers add them to a class's Routine tab."
          />
        </Card>
      ) : (
        <WeekView slots={data} showClass />
      )}
    </div>
  );
}
