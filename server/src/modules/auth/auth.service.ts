import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { normalizeStudentId, studentIdKey } from '../../utils/helpers';
import { NotificationService } from '../notification/notification.service';
import { User, UserDocument } from '../user/user.model';
import { LoginInput, RegisterInput } from './auth.validation';

export const signToken = (user: UserDocument) =>
  jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });

const register = async (input: RegisterInput) => {
  if (await User.exists({ email: input.email })) {
    throw ApiError.conflict('An account with this email already exists. Log in instead.');
  }
  if (input.role === 'student' && (await User.exists({ studentKey: studentIdKey(input.studentId) }))) {
    throw ApiError.conflict('An account with this register ID already exists. Log in instead, or ask your teacher for help.');
  }

  const user = await User.create({
    ...input,
    studentId: input.role === 'student' ? normalizeStudentId(input.studentId) : undefined,
    employeeId: input.role === 'teacher' ? input.employeeId.trim().toUpperCase() : undefined,
    teacherStatus: input.role === 'teacher' ? (env.teacherApproval ? 'pending' : 'approved') : undefined,
  });

  if (user.role === 'teacher' && user.teacherStatus === 'pending') {
    // tell the admins someone is waiting for approval
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
    NotificationService.notifyUsers(
      admins.map((a) => a._id),
      {
        kind: 'account',
        title: 'New teacher waiting for approval',
        body: `${user.name} · ${user.department ?? ''} · ID ${user.employeeId}\n${user.email}`,
        url: '/admin',
        tag: 'teacher-approval',
      },
    ).catch(() => undefined);
  }
  return { user, token: signToken(user) };
};

const login = async (input: LoginInput) => {
  const id = input.identifier;
  const query = id.includes('@') ? { email: id.toLowerCase() } : { studentKey: studentIdKey(id) };
  const user = await User.findOne(query).select('+password');
  if (!user || !(await user.comparePassword(input.password))) {
    throw ApiError.unauthorized(id.includes('@') ? 'Incorrect email or password' : 'Incorrect register ID or password');
  }
  if (!user.isActive) throw ApiError.forbidden('This account is disabled. Contact the admin.');
  return { user, token: signToken(user) };
};

export const AuthService = { register, login };
