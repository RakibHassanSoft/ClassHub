import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 5000),
  clientUrls: (process.env.CLIENT_URL ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  /** New teachers must be verified by an admin before they can create classes (TEACHER_APPROVAL=off skips it). */
  teacherApproval: process.env.TEACHER_APPROVAL !== 'off',
  /** Sign-up is limited to these email domains (default gmail.com). Comma separated; "*" = any email. */
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS || 'gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase().replace(/^@/, ''))
    .filter((s) => s && s !== '*'),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-flash-latest',
  geminiBaseUrl: process.env.GEMINI_BASE_URL ?? '', // optional: proxy / testing
  appUrl: process.env.APP_URL ?? (process.env.CLIENT_URL ?? 'http://localhost:3000').split(',')[0].trim(),
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@classhub.app',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    folder: process.env.CLOUDINARY_FOLDER ?? 'classhub',
  },
  /** Public base URL of this API, used for files stored on local disk when Cloudinary is not configured. */
  publicApiUrl: (process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 5000}`).replace(/\/$/, ''),
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 10),
  timezone: process.env.TIMEZONE ?? 'Asia/Dhaka',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '',
  },
};
