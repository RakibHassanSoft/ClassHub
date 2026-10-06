'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MessageCircleOff, Settings } from 'lucide-react';
import { useClassContext } from '@/components/class/class-context';
import { ChatThread } from '@/components/chat/chat-thread';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, PageLoader } from '@/components/ui/misc';
import { get } from '@/lib/api';

export default function ClassChatPage() {
  const { classroom, isTeacher } = useClassContext();
  const enabled = classroom.settings.chatEnabled !== false;
  const { data, isLoading } = useQuery({
    queryKey: ['chat', 'class', classroom._id],
    queryFn: () => get<{ _id: string }>(`/chat/class/${classroom._id}`),
    enabled: enabled || isTeacher,
  });

  if (!enabled && !isTeacher) {
    return (
      <Card>
        <EmptyState icon={<MessageCircleOff />} title="Chat is off" description="Your teacher has turned off the class chat." />
      </Card>
    );
  }
  if (isLoading || !data) return <PageLoader />;

  return (
    <div className="space-y-3">
      {!enabled && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Chat is turned off for students. Only you can see this.
          <Link href={`/classes/${classroom._id}/settings`}>
            <Button size="sm" variant="outline">
              <Settings /> Settings
            </Button>
          </Link>
        </div>
      )}
      <Card className="flex h-[calc(100dvh-26rem)] min-h-[420px] flex-col overflow-hidden">
        <ChatThread conversationId={data._id} />
      </Card>
    </div>
  );
}
