import { z } from 'zod';
import { isIsoDate } from '../../utils/helpers';
import { ASSESSMENT_CATEGORIES } from './marks.model';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createAssessmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  category: z.enum(ASSESSMENT_CATEGORIES).optional(),
  maxMarks: z.number().positive('Total marks must be more than 0').max(1000),
  weight: z.number().min(0).max(100).nullable().optional(),
  date: z.string().refine(isIsoDate, 'Invalid date').optional().or(z.literal('')),
  published: z.boolean().optional(),
});

export const updateAssessmentSchema = createAssessmentSchema.partial();

export const saveScoresSchema = z.object({
  scores: z
    .array(
      z.object({
        entry: objectId,
        score: z.number().min(0).nullable(),
        remarks: z.string().trim().max(200).optional(),
      }),
    )
    .max(2000),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type SaveScoresInput = z.infer<typeof saveScoresSchema>;
