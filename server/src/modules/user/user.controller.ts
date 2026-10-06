import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { UserService } from './user.service';

const getMe = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'Profile', data: req.user });
});

const updateMe = catchAsync(async (req, res) => {
  const user = await UserService.updateProfile(String(req.user!._id), req.body);
  sendResponse(res, { message: 'Profile updated', data: user });
});

const changePassword = catchAsync(async (req, res) => {
  await UserService.changePassword(String(req.user!._id), req.body);
  sendResponse(res, { message: 'Password changed' });
});

export const UserController = { getMe, updateMe, changePassword };
