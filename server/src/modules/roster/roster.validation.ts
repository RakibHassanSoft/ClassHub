import { z } from 'zod';

const email = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email');

export const rosterRowSchema = z.object({
  studentId: z.string().trim().min(1, 'Student ID is required').max(40),
  name: z.string().trim().min(1, 'Name is required').max(100),
  email,
  phone: z.string().trim().max(30).optional(),
  section: z.string().trim().max(30).optional(),
});

export const addRosterSchema = rosterRowSchema;

export const bulkRosterSchema = z.object({
  source: z.enum(['csv', 'ai', 'manual']).default('csv'),
  /** update = overwrite name/email for IDs that already exist; skip = leave them */
  onDuplicate: z.enum(['update', 'skip']).default('update'),
  rows: z.array(rosterRowSchema).min(1, 'No students to import').max(1000),
});

export const updateRosterSchema = rosterRowSchema.partial();

export type RosterRowInput = z.infer<typeof rosterRowSchema>;
export type BulkRosterInput = z.infer<typeof bulkRosterSchema>;
