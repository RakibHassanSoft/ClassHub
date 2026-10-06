import { ApiError } from '../../utils/ApiError';
import { env } from '../../config/env';
import { User } from './user.model';
import { ChangePasswordInput, UpdateProfileInput } from './user.validation';

const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  const { email, ...rest } = input;
  user.set(rest);
  if (email !== undefined) {
    if (!email) throw ApiError.badRequest('Your account needs an email address');
    const domains = env.allowedEmailDomains;
    if (email !== user.email && domains.length && !domains.includes(email.split('@')[1])) {
      throw ApiError.badRequest(`Use your ${domains.map((d) => '@' + d).join(' or ')} address`);
    }
    if (email && email !== user.email && (await User.exists({ email, _id: { $ne: user._id } }))) {
      throw ApiError.conflict('Another account already uses this email');
    }
    user.email = email || undefined;
  }
  await user.save();
  return user;
};

const changePassword = async (userId: string, input: ChangePasswordInput) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found');
  const ok = await user.comparePassword(input.currentPassword);
  if (!ok) throw ApiError.badRequest('Current password is incorrect');
  user.password = input.newPassword;
  await user.save();
};

export const UserService = { updateProfile, changePassword };
