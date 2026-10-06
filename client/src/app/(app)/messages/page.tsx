import { MessagesSquare } from 'lucide-react';
import { EmptyState } from '@/components/ui/misc';

export default function MessagesHome() {
  return (
    <div className="grid flex-1 place-items-center">
      <EmptyState
        icon={<MessagesSquare />}
        title="Select a chat"
        description="Class group chats and private messages with your teachers or students."
      />
    </div>
  );
}
