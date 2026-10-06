import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { aiEnabled, COMPOSE_MODES, composeHelp } from '../../lib/ai';

const limiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 40,
  keyGenerator: (req) => (req.user ? String(req.user._id) : ipKeyGenerator(req.ip ?? '')),
  message: { success: false, message: 'You have used the AI helper a lot. Try again in a few minutes.' },
});

const router = Router();

router.get(
  '/status',
  auth(),
  catchAsync(async (_req, res) => {
    sendResponse(res, { message: 'AI status', data: { enabled: aiEnabled() } });
  }),
);

router.post(
  '/compose',
  auth(),
  limiter,
  validate(z.object({ text: z.string().trim().min(2, 'Write something first').max(3000), mode: z.enum(COMPOSE_MODES).default('polish') })),
  catchAsync(async (req, res) => {
    if (!aiEnabled()) throw new ApiError(503, 'The AI helper is not set up yet. Ask the admin to add a Gemini API key.');
    const text = await composeHelp(req.body.text, req.body.mode, req.user!.role === 'student' ? 'student' : 'teacher');
    if (!text) throw new ApiError(502, 'The AI helper could not answer right now. Please try again.');
    sendResponse(res, { message: 'Suggestion', data: { text } });
  }),
);

export const AiRoutes = router;
