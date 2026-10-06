import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { env } from '../../config/env';
import { AuthService } from './auth.service';

const register = catchAsync(async (req, res) => {
  const result = await AuthService.register(req.body);
  sendResponse(res, {
    statusCode: 201,
    message: result.user.teacherStatus === 'pending' ? 'Account created. An admin will verify it soon.' : 'Account created',
    data: result,
  });
});

const login = catchAsync(async (req, res) => {
  const result = await AuthService.login(req.body);
  sendResponse(res, { message: 'Logged in', data: result });
});

/** Sign-up rules shown by the web app. */
const config = catchAsync(async (_req, res) => {
  sendResponse(res, { message: 'Auth config', data: { allowedEmailDomains: env.allowedEmailDomains } });
});

export const AuthController = { register, login, config };
