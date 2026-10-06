import { z } from 'zod';
import { env } from '../config/env';

/** Email used for sign-up / profile. Limited to ALLOWED_EMAIL_DOMAINS (default gmail.com). */
export const emailField = () =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .pipe(z.email('Enter a valid email'))
    .refine((v) => !env.allowedEmailDomains.length || env.allowedEmailDomains.includes(v.split('@')[1]), {
      message: `Use your ${env.allowedEmailDomains.map((d) => '@' + d).join(' or ')} address`,
    });
