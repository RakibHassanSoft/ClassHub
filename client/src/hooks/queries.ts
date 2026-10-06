'use client';

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import type {
  AttendanceRegister,
  AttendanceAnalytics,
  ClassPeople,
  Classroom,
  UpcomingItem,
  ConversationDetail,
  ConversationSummary,
  MarksSheet,
  MyAttendance,
  MyMarks,
  Notice,
  Resource,
  RosterEntry,
  RoutineSlot,
} from '@/lib/types';

export const qk = {
  classes: ['classes'] as const,
  class: (id: string) => ['class', id] as const,
  roster: (id: string) => ['class', id, 'roster'] as const,
  attendance: (id: string) => ['class', id, 'attendance'] as const,
  myAttendance: (id: string) => ['class', id, 'attendance', 'me'] as const,
  session: (id: string, sid: string) => ['class', id, 'attendance', sid] as const,
  routine: (id: string) => ['class', id, 'routine'] as const,
  myWeek: ['routine', 'me'] as const,
  resources: (id: string) => ['class', id, 'resources'] as const,
  marks: (id: string) => ['class', id, 'marks'] as const,
  myMarks: (id: string) => ['class', id, 'marks', 'me'] as const,
  notices: (id: string) => ['class', id, 'notices'] as const,
  feed: ['notices', 'feed'] as const,
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: string) => ['chat', 'conversation', id] as const,
  audit: (id: string, entity: string) => ['class', id, 'audit', entity] as const,
};

export const useClasses = () => useQuery({ queryKey: qk.classes, queryFn: () => get<Classroom[]>('/classes') });
export const useClassroom = (id: string) =>
  useQuery({ queryKey: qk.class(id), queryFn: () => get<Classroom>(`/classes/${id}`), enabled: Boolean(id) });
export const useRoster = (id: string) => useQuery({ queryKey: qk.roster(id), queryFn: () => get<RosterEntry[]>(`/classes/${id}/roster`) });
export const useAttendanceRegister = (id: string, enabled = true) =>
  useQuery({ queryKey: qk.attendance(id), queryFn: () => get<AttendanceRegister>(`/classes/${id}/attendance`), enabled });
export const useMyAttendance = (id: string, enabled = true) =>
  useQuery({ queryKey: qk.myAttendance(id), queryFn: () => get<MyAttendance>(`/classes/${id}/attendance/me`), enabled });
export const useRoutine = (id: string) =>
  useQuery({ queryKey: qk.routine(id), queryFn: () => get<RoutineSlot[]>(`/classes/${id}/routine`) });
export const useMyWeek = () => useQuery({ queryKey: qk.myWeek, queryFn: () => get<RoutineSlot[]>('/routine/me') });
export const useResources = (id: string) =>
  useQuery({ queryKey: qk.resources(id), queryFn: () => get<Resource[]>(`/classes/${id}/resources`) });
export const useMarksSheet = (id: string, enabled = true) =>
  useQuery({ queryKey: qk.marks(id), queryFn: () => get<MarksSheet>(`/classes/${id}/marks`), enabled });
export const useMyMarks = (id: string, enabled = true) =>
  useQuery({ queryKey: qk.myMarks(id), queryFn: () => get<MyMarks>(`/classes/${id}/marks/me`), enabled });
export const useNotices = (id: string) => useQuery({ queryKey: qk.notices(id), queryFn: () => get<Notice[]>(`/classes/${id}/notices`) });
export const useFeed = () =>
  useQuery({
    queryKey: qk.feed,
    queryFn: () => get<{ items: Notice[]; unread: number }>('/notices/feed'),
    refetchInterval: 60_000,
  });

export const useConversations = () =>
  useQuery({
    queryKey: qk.conversations,
    queryFn: () => get<{ items: ConversationSummary[]; unread: number }>('/chat/conversations'),
    refetchInterval: 120_000,
  });
export const useConversation = (id: string) =>
  useQuery({ queryKey: qk.conversation(id), queryFn: () => get<ConversationDetail>(`/chat/conversations/${id}`), enabled: Boolean(id) });
export const useAttendanceAnalytics = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['class', id, 'attendance', 'analytics'],
    queryFn: () => get<AttendanceAnalytics>(`/classes/${id}/attendance/analytics`),
    enabled,
  });
export const usePeople = (id: string) =>
  useQuery({ queryKey: ['class', id, 'people'], queryFn: () => get<ClassPeople>(`/classes/${id}/people`) });
export const useUpcoming = () =>
  useQuery({ queryKey: ['classwork', 'upcoming'], queryFn: () => get<UpcomingItem[]>('/classwork/upcoming') });

/** Whether the AI helper (Gemini) is set up on the server. */
export const useAiStatus = () =>
  useQuery({ queryKey: ['ai', 'status'], queryFn: () => get<{ enabled: boolean }>('/ai/status'), staleTime: 10 * 60_000 });
