import { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { Classroom } from './class.model';
import { Membership } from './membership.model';

/**
 * Loads the class from :classId and checks the current user's membership.
 * level 'member'  -> any teacher or student of the class
 * level 'teacher' -> teachers of the class only
 */
export const classAccess =
  (level: 'member' | 'teacher' = 'member') =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params as { classId?: string };
      if (!classId || !isValidObjectId(classId)) throw ApiError.notFound('Class not found');

      const [classroom, membership] = await Promise.all([
        Classroom.findById(classId),
        Membership.findOne({ classroom: classId, user: req.user!._id }),
      ]);
      if (!classroom) throw ApiError.notFound('Class not found');
      if (!membership) throw ApiError.forbidden('You are not a member of this class');
      if (level === 'teacher' && membership.role !== 'teacher') {
        throw ApiError.forbidden('Only the class teacher can do this');
      }

      req.classroom = classroom;
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
