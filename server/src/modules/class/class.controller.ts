import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { ClassService } from './class.service';

const create = catchAsync(async (req, res) => {
  const data = await ClassService.createClass(req.user!, req.body);
  sendResponse(res, { statusCode: 201, message: 'Class created', data });
});

const listMine = catchAsync(async (req, res) => {
  const data = await ClassService.listMyClasses(req.user!);
  sendResponse(res, { message: 'Classes', data });
});

const getOne = catchAsync(async (req, res) => {
  const data = await ClassService.getClassDetails(
    req.classroom!,
    req.membership!.role,
    req.user!,
    Boolean(req.membership!.isCR),
  );
  sendResponse(res, { message: 'Class', data });
});

const update = catchAsync(async (req, res) => {
  const data = await ClassService.updateClass(req.classroom!, req.body);
  sendResponse(res, { message: 'Class updated', data });
});

const resetJoinCode = catchAsync(async (req, res) => {
  const data = await ClassService.resetJoinCode(req.classroom!);
  sendResponse(res, { message: 'New invite link created', data });
});

const remove = catchAsync(async (req, res) => {
  await ClassService.deleteClass(req.classroom!, req.user!);
  sendResponse(res, { message: 'Class deleted' });
});

const leave = catchAsync(async (req, res) => {
  await ClassService.leaveClass(req.classroom!, req.user!);
  sendResponse(res, { message: 'You left the class' });
});

const joinPreview = catchAsync(async (req, res) => {
  const data = await ClassService.getJoinPreview(String(req.params.code), req.user!);
  sendResponse(res, { message: 'Invite', data });
});

const join = catchAsync(async (req, res) => {
  const data = await ClassService.joinClass(String(req.params.code), req.user!);
  sendResponse(res, { message: data.alreadyMember ? 'You are already in this class' : 'Joined class', data });
});

const people = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'People', data: await ClassService.getPeople(req.classroom!, req.membership!.role) });
});
const addTeacher = catchAsync(async (req, res) => {
  const data = await ClassService.addCoTeacher(req.classroom!, req.user!, req.body.email);
  sendResponse(res, { statusCode: 201, message: `${data.name} is now a teacher of this class`, data });
});
const removeTeacher = catchAsync(async (req, res) => {
  await ClassService.removeCoTeacher(req.classroom!, req.user!, String(req.params.userId));
  sendResponse(res, { message: 'Teacher removed' });
});
const setCR = catchAsync(async (req, res) => {
  const data = await ClassService.setRepresentative(
    req.classroom!,
    req.user!,
    String(req.params.userId),
    req.body.isCR,
  );
  sendResponse(res, { message: data.isCR ? 'Class representative added' : 'Class representative removed', data });
});

const clone = catchAsync(async (req, res) => {
  const data = await ClassService.cloneClass(req.classroom!, req.user!, req.body);
  sendResponse(res, { statusCode: 201, message: 'New class created from template', data });
});

export const ClassController = {
  clone,
  people,
  addTeacher,
  removeTeacher,
  setCR,
  create,
  listMine,
  getOne,
  update,
  resetJoinCode,
  remove,
  leave,
  joinPreview,
  join,
};
