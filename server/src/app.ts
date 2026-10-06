import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler, notFound } from './middlewares/errorHandler';
import routes from './routes';

const app = express();

app.set('trust proxy', 1);
// files and images are loaded by the web app from another origin
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || env.clientUrls.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (!env.isProd) app.use(morgan('dev'));

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'ClassHub API is running', docs: '/api/v1/health' });
});
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, message: 'OK', time: new Date().toISOString() });
});

// local file storage (only used when Cloudinary is not configured)
app.use(
  '/uploads',
  express.static(path.resolve(env.uploadDir), {
    maxAge: '30d',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }),
);

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
