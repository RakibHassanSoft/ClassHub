'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-store';
import { getSocket } from '@/lib/socket';
import { qk } from './queries';

/** One socket per session: keeps unread counts, notices and chats live. */
export const useRealtime = () => {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!token) return undefined;
    const socket = getSocket(token);

    const onMessage = (p: { conversationId: string }) => {
      qc.invalidateQueries({ queryKey: qk.conversations });
      window.dispatchEvent(new CustomEvent('classhub:message', { detail: p }));
    };
    const onDeleted = (p: { conversationId: string; messageId: string }) => {
      window.dispatchEvent(new CustomEvent('classhub:message-deleted', { detail: p }));
    };
    const onUpdated = (p: { conversationId: string; messageId: string; patch: Record<string, unknown> }) => {
      window.dispatchEvent(new CustomEvent('classhub:message-updated', { detail: p }));
    };
    const onRead = (p: { conversationId: string; userId: string; at: string }) => {
      window.dispatchEvent(new CustomEvent('classhub:conversation-read', { detail: p }));
    };
    const onNoticeUpdated = (p: { classId: string }) => {
      qc.invalidateQueries({ queryKey: qk.feed });
      qc.invalidateQueries({ queryKey: qk.notices(p.classId) });
    };
    const onReminder = (p: { classId?: string; title: string; body?: string; url?: string }) => {
      qc.invalidateQueries({ queryKey: qk.feed });
      toast.info(p.title, {
        description: p.body?.split('\n').slice(0, 2).join(' · '),
        duration: 10_000,
        action: p.url ? { label: 'Open', onClick: () => router.push(p.url!) } : undefined,
      });
    };
    const onNotice = (p: { classId: string; title: string; type: string; className: string }) => {
      qc.invalidateQueries({ queryKey: qk.feed });
      qc.invalidateQueries({ queryKey: qk.notices(p.classId) });
      const label = p.type === 'urgent' ? 'Urgent' : p.type === 'cancel' ? 'Class cancelled' : 'New notice';
      const fn = p.type === 'urgent' || p.type === 'cancel' ? toast.warning : toast.info;
      fn(`${label} · ${p.className}`, {
        description: p.title,
        action: { label: 'Open', onClick: () => router.push(`/classes/${p.classId}`) },
      });
    };

    const onCheckinOpen = (p: { classId: string; className: string }) => {
      qc.invalidateQueries({ queryKey: ['checkin-active', p.classId] });
      toast.info(`Attendance check-in is open · ${p.className}`, {
        description: 'Enter the code shown in class.',
        action: { label: 'Check in', onClick: () => router.push(`/classes/${p.classId}`) },
      });
    };
    const onCheckinClosed = (p: { classId: string }) => qc.invalidateQueries({ queryKey: ['checkin-active', p.classId] });

    const onClasswork = (p: { classId: string; id: string; type: string; title: string; className: string }) => {
      qc.invalidateQueries({ queryKey: ['class', p.classId, 'classwork'] });
      qc.invalidateQueries({ queryKey: ['classwork', 'upcoming'] });
      qc.invalidateQueries({ queryKey: qk.resources(p.classId) });
      const label: Record<string, string> = {
        homework: 'New homework',
        class_test: 'Class test announced',
        exam_syllabus: 'Exam syllabus posted',
        class_log: 'Class diary updated',
        material: 'New material',
      };
      toast.info(`${label[p.type] ?? 'New post'} · ${p.className}`, {
        description: p.title,
        action: {
          label: 'Open',
          onClick: () =>
            router.push(
              p.type === 'material' ? `/classes/${p.classId}/classwork?tab=material` : `/classes/${p.classId}/classwork?item=${p.id}`,
            ),
        },
      });
    };
    const onClassworkUpdated = (p: { classId: string; id: string; title: string; className: string; what: string }) => {
      qc.invalidateQueries({ queryKey: ['class', p.classId, 'classwork'] });
      qc.invalidateQueries({ queryKey: ['classwork', 'upcoming'] });
      toast.warning(`${p.title} · ${p.className}`, {
        description: p.what,
        action: { label: 'Open', onClick: () => router.push(`/classes/${p.classId}/classwork?item=${p.id}`) },
      });
    };
    const onGraded = (p: { classId: string; id: string; title: string; className: string }) => {
      qc.invalidateQueries({ queryKey: ['class', p.classId, 'classwork'] });
      toast.success(`Homework checked · ${p.className}`, {
        description: p.title,
        action: { label: 'See marks', onClick: () => router.push(`/classes/${p.classId}/classwork?item=${p.id}`) },
      });
    };
    const onSubmission = (p: { classId: string; id: string; name: string; title: string; late: boolean }) => {
      qc.invalidateQueries({ queryKey: ['class', p.classId, 'classwork'] });
      toast.info(`${p.name} submitted${p.late ? ' late' : ''}`, { description: p.title });
    };
    socket.on('classwork:new', onClasswork);
    socket.on('classwork:updated', onClassworkUpdated);
    socket.on('submission:graded', onGraded);
    socket.on('submission:new', onSubmission);
    socket.on('checkin:open', onCheckinOpen);
    socket.on('checkin:closed', onCheckinClosed);
    socket.on('message:new', onMessage);
    socket.on('message:deleted', onDeleted);
    socket.on('message:updated', onUpdated);
    socket.on('conversation:read', onRead);
    socket.on('notice:updated', onNoticeUpdated);
    socket.on('notice:new', onNotice);
    socket.on('notification:new', onReminder);
    return () => {
      socket.off('classwork:new', onClasswork);
      socket.off('classwork:updated', onClassworkUpdated);
      socket.off('submission:graded', onGraded);
      socket.off('submission:new', onSubmission);
      socket.off('checkin:open', onCheckinOpen);
      socket.off('checkin:closed', onCheckinClosed);
      socket.off('message:new', onMessage);
      socket.off('message:deleted', onDeleted);
      socket.off('message:updated', onUpdated);
      socket.off('conversation:read', onRead);
      socket.off('notice:updated', onNoticeUpdated);
      socket.off('notice:new', onNotice);
      socket.off('notification:new', onReminder);
    };
  }, [token, qc, router]);
};
