import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  institution: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().toLowerCase().max(120).pipe(z.email('Enter a valid email')).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(100),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
