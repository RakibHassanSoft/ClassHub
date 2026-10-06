import { z } from 'zod';
import { NOTICE_TYPES } from './notice.model';

export const createNoticeSchema = z.object({
  type: z.enum(NOTICE_TYPES).optional(),
  title: z.string().trim().min(1, 'Title is required').max(150),
  body: z.string().trim().max(5000).optional(),
  link: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Link must start with https://')
    .optional(),
  pinned: z.boolean().optional(),
});

export const updateNoticeSchema = createNoticeSchema.partial();

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;
