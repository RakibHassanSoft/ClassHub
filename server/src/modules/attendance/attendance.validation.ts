import { z } from 'zod';
import { isIsoDate } from '../../utils/helpers';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const isoDate = z.string().refine(isIsoDate, 'Date must be in YYYY-MM-DD format');

export const createSessionSchema = z.object({
  date: isoDate,
  label: z.string().trim().max(40).optional().default(''),
  topic: z.string().trim().max(200).optional(),
  /** status every student starts with; '' leaves everyone unmarked */
  defaultStatus: z.string().trim().max(3).optional().default('P'),
});

export const updateSessionSchema = z.object({
  date: isoDate.optional(),
  label: z.string().trim().max(40).optional(),
  topic: z.string().trim().max(200).optional(),
  records: z
    .array(
      z.object({
        entry: objectId,
        status: z.string().trim().max(3),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .max(2000)
    .optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
