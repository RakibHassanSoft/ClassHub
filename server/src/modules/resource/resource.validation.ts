import { z } from 'zod';

const url = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:\/\/\S+$/i.test(v), 'Enter a full link starting with https://');

const base = z.object({
  title: z.string().trim().min(1, 'Title is required').max(150),
  kind: z.enum(['drive', 'link', 'note', 'file']).optional(),
  attachmentIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i))
    .max(20)
    .optional(),
  url: url.optional(),
  topic: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  pinned: z.boolean().optional(),
  notifyChat: z.boolean().optional(),
});

export const createResourceSchema = base
  .refine((r) => r.kind === 'note' || r.kind === 'file' || Boolean(r.url), {
    message: 'Paste the Google Drive link',
    path: ['url'],
  })
  .refine((r) => r.kind !== 'file' || Boolean(r.attachmentIds?.length), {
    message: 'Upload at least one file',
    path: ['attachmentIds'],
  });

export const updateResourceSchema = base.partial();

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
