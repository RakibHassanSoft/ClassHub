import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const startDirectSchema = z.object({ classId: objectId, userId: objectId });
export const sendMessageSchema = z.object({ text: z.string().trim().min(1, 'Message is empty').max(4000) });
export const listMessagesSchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export const contactsSchema = z.object({ classId: objectId });

export const sendRichSchema = z
  .object({
    text: z.string().trim().max(4000).optional().default(''),
    attachmentIds: z.array(objectId).max(10).optional(),
    replyTo: objectId.optional(),
    poll: z
      .object({
        question: z.string().trim().min(1, 'Write the poll question').max(300),
        options: z.array(z.string().trim().min(1).max(120)).min(2, 'Add at least 2 options').max(10),
        multiple: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((d) => d.text.length > 0 || Boolean(d.attachmentIds?.length) || Boolean(d.poll), { message: 'Message is empty', path: ['text'] });

export const voteSchema = z.object({ optionIds: z.array(z.string().max(20)).max(10) });
