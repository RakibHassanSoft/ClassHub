import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { mailEnabled, sendMail } from '../../lib/mailer';
import { env } from '../../config/env';
import { Classroom } from '../class/class.model';
import { NotificationService } from '../notification/notification.service';
import { TeacherStatus, User, UserDocument } from '../user/user.model';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stats = async () => {
  const [pending, approved, rejected, students, classes, disabled] = await Promise.all([
    User.countDocuments({ role: 'teacher', teacherStatus: 'pending' }),
    User.countDocuments({ role: 'teacher', teacherStatus: { $in: ['approved', null] } }),
    User.countDocuments({ role: 'teacher', teacherStatus: 'rejected' }),
    User.countDocuments({ role: 'student' }),
    Classroom.countDocuments({ archived: false }),
    User.countDocuments({ isActive: false }),
  ]);
  return { teachers: { pending, approved, rejected }, students, classes, disabled };
};

/** Teachers (by approval status) or students, newest first, with optional search. */
const listUsers = async (q: { role: 'teacher' | 'student'; status?: TeacherStatus; search?: string; limit: number }) => {
  const filter: Record<string, unknown> = { role: q.role };
  if (q.role === 'teacher' && q.status) filter.teacherStatus = q.status === 'approved' ? { $in: ['approved', null] } : q.status;
  if (q.search) {
    const re = new RegExp(escapeRegex(q.search.trim()), 'i');
    filter.$or = [{ name: re }, { email: re }, { studentId: re }, { employeeId: re }, { department: re }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(q.limit).populate('reviewedBy', 'name').lean();
  if (q.role !== 'teacher') return users;
  // how many classes each teacher owns
  const counts = await Classroom.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { owner: { $in: users.map((u) => u._id) } } },
    { $group: { _id: '$owner', n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  return users.map((u) => ({ ...u, teacherStatus: u.teacherStatus ?? 'approved', classes: byId.get(String(u._id)) ?? 0 }));
};

/** Approve or reject a teacher. The teacher is told in the app, by push and (if set up) by email. */
const reviewTeacher = async (admin: UserDocument, id: string, input: { status: 'approved' | 'rejected'; note?: string }) => {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Teacher not found');
  const teacher = await User.findOne({ _id: id, role: 'teacher' });
  if (!teacher) throw ApiError.notFound('Teacher not found');
  teacher.teacherStatus = input.status;
  teacher.reviewNote = input.status === 'rejected' ? input.note || undefined : undefined;
  teacher.reviewedAt = new Date();
  teacher.reviewedBy = admin._id;
  await teacher.save();

  const approved = input.status === 'approved';
  const title = approved ? 'Your teacher account is approved' : 'Your teacher account was not approved';
  const body = approved
    ? 'You can now create classes, add your students and start teaching on ClassHub.'
    : input.note || 'Please contact the admin for details.';
  await NotificationService.notifyUsers([teacher._id], { kind: 'account', title, body, url: approved ? '/classes' : '/profile' }).catch(
    () => undefined,
  );
  if (mailEnabled() && teacher.email) {
    sendMail({
      bcc: [teacher.email],
      subject: `ClassHub: ${title}`,
      heading: title,
      body,
      actionUrl: `${env.appUrl}/${approved ? 'classes' : 'login'}`,
      actionLabel: 'Open ClassHub',
    }).catch(() => undefined);
  }
  return teacher;
};

/** Disable / enable any account (a disabled user cannot log in). */
const setActive = async (admin: UserDocument, id: string, isActive: boolean) => {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('User not found');
  if (String(admin._id) === id) throw ApiError.badRequest('You cannot disable your own account');
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === 'admin') throw ApiError.forbidden('Admins cannot be disabled here');
  user.isActive = isActive;
  await user.save();
  return user;
};

export const AdminService = { stats, listUsers, reviewTeacher, setActive };
