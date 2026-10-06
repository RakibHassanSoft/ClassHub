import { z } from 'zod';
import { emailField } from '../../lib/email-rules';

const idField = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `Enter your ${label}`)
    .max(40)
    .refine((v) => /[a-z0-9]/i.test(v), `Enter a valid ${label}`);

const base = {
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(80),
  email: emailField(),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  institution: z.string().trim().max(120).optional(),
};

/**
 * Students: name, Gmail, password and register ID (links them to classes).
 * Teachers: name, Gmail, password, employee ID and department — an admin approves them before they can teach.
 */
export const registerSchema = z.discriminatedUnion('role', [
  z.object({
    ...base,
    role: z.literal('student'),
    studentId: idField('register ID'),
    department: z.string().trim().max(120).optional(),
  }),
  z.object({
    ...base,
    role: z.literal('teacher'),
    employeeId: idField('employee ID'),
    department: z.string().trim().min(2, 'Enter your department').max(120),
  }),
]);

/** `identifier` is an email or a register ID. `email` is still accepted for older clients. */
export const loginSchema = z
  .object({
    identifier: z.string().trim().max(120).optional(),
    email: z.string().trim().max(120).optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .transform((d) => ({ identifier: (d.identifier || d.email || '').trim(), password: d.password }))
  .refine((d) => d.identifier.length > 0, { message: 'Enter your email or register ID', path: ['identifier'] });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
