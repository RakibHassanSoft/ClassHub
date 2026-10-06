import { z } from 'zod';
import { isIsoDate } from '../../utils/helpers';
import { CLASSWORK_TYPES } from './classwork.model';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const url = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:\/\/\S+$/i.test(v), 'Links must start with https://');
const dateTime = z.string().datetime({ offset: true, message: 'Invalid date/time' }).nullable().optional();

const base = z.object({
  type: z.enum(CLASSWORK_TYPES),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(10000).optional(),
  date: z.string().refine(isIsoDate, 'Date must be YYYY-MM-DD').optional(),
  dueAt: dateTime,
  eventAt: dateTime,
  examType: z.enum(['mid', 'final', 'other']).optional(),
  allowSubmission: z.boolean().optional(),
  allowLate: z.boolean().optional(),
  maxScore: z.number().min(0).max(1000).nullable().optional(),
  links: z
    .array(z.object({ url, title: z.string().trim().max(150).optional() }))
    .max(20)
    .optional(),
  attachmentIds: z.array(objectId).max(20).optional(),
  pinned: z.boolean().optional(),
  notifyChat: z.boolean().optional(), // also post a card in the class chat (default true)
});

export const createClassworkSchema = base
  .refine((d) => d.type !== 'class_log' || Boolean(d.date), { message: 'Pick the class date', path: ['date'] })
  .refine((d) => d.type !== 'class_test' || Boolean(d.eventAt), {
    message: 'Pick the class test date and time',
    path: ['eventAt'],
  });

export const updateClassworkSchema = base.omit({ type: true, notifyChat: true }).partial();

export const submitSchema = z
  .object({
    text: z.string().trim().max(5000).optional(),
    attachmentIds: z.array(objectId).max(10).optional(),
  })
  .refine((d) => Boolean(d.text) || Boolean(d.attachmentIds?.length), {
    message: 'Add a file or write your answer',
    path: ['text'],
  });

export const gradeSchema = z.object({
  score: z.number().min(0).max(1000).nullable().optional(),
  feedback: z.string().trim().max(2000).optional(),
});

export type CreateClassworkInput = z.infer<typeof createClassworkSchema>;
export type UpdateClassworkInput = z.infer<typeof updateClassworkSchema>;
