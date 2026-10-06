import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { AttendanceService } from './attendance.service';

const register = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'Attendance register', data: await AttendanceService.getRegister(req.classroom!) });
});

const mine = catchAsync(async (req, res) => {
  const data = await AttendanceService.getMyAttendance(req.classroom!, req.membership!);
  sendResponse(res, { message: 'My attendance', data });
});

const create = catchAsync(async (req, res) => {
  const data = await AttendanceService.createSession(req.classroom!, req.user!, req.body);
  sendResponse(res, { statusCode: 201, message: 'Attendance sheet created', data });
});

const getOne = catchAsync(async (req, res) => {
  const data = await AttendanceService.getSession(req.classroom!, String(req.params.sessionId));
  sendResponse(res, { message: 'Attendance', data });
});

const update = catchAsync(async (req, res) => {
  const data = await AttendanceService.updateSession(req.classroom!, req.user!, String(req.params.sessionId), req.body);
  sendResponse(res, { message: 'Attendance saved', data });
});

const remove = catchAsync(async (req, res) => {
  await AttendanceService.deleteSession(req.classroom!, String(req.params.sessionId), req.user!);
  sendResponse(res, { message: 'Attendance deleted' });
});

const analytics = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'Attendance insights', data: await AttendanceService.getAnalytics(req.classroom!) });
});

export const AttendanceController = {
  analytics,
  register,
  mine,
  create,
  getOne,
  update,
  remove,
};
