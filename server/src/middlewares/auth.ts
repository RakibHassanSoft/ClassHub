import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { User, UserRole } from '../modules/user/user.model';

export interface JwtPayload {
  sub: string;
  role: UserRole;
}

/** What a teacher waiting for approval may still use: own profile, notifications, push setup. */
const OPEN_FOR_UNVERIFIED = /^\/api\/v1\/(users\/me|notices\/feed|notifications|push)(\/|\?|$)/;

export const auth =
  (...roles: UserRole[]) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      if (!token) throw ApiError.unauthorized();

      let payload: JwtPayload;
      try {
        payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
      } catch {
        throw ApiError.unauthorized('Your session has expired. Please log in again.');
      }

      const user = await User.findById(payload.sub);
      if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or disabled');
      // Teachers can use ClassHub only after an admin has verified them
      if (user.role === 'teacher' && (user.teacherStatus ?? 'approved') !== 'approved' && !OPEN_FOR_UNVERIFIED.test(req.originalUrl)) {
        throw ApiError.forbidden(
          user.teacherStatus === 'rejected'
            ? 'Your teacher account was not approved. Contact the admin.'
            : 'Your teacher account is waiting for admin approval.',
        );
      }
      if (roles.length && !roles.includes(user.role)) throw ApiError.forbidden();

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
