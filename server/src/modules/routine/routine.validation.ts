import { z } from 'zod';
import { SLOT_TYPES } from './routine.model';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (24-hour)');

const base = z.object({
  day: z.number().int().min(0).max(6),
  startTime: time,
  endTime: time,
  room: z.string().trim().max(60).optional(),
  type: z.enum(SLOT_TYPES).optional(),
  note: z.string().trim().max(200).optional(),
});

export const createSlotSchema = base.refine((s) => s.endTime > s.startTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export const updateSlotSchema = base.partial().refine((s) => !s.startTime || !s.endTime || s.endTime > s.startTime, {
  message: 'End time must be after start time',
  path: ['endTime'],
});

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
