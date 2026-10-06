import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { RoutineService } from './routine.service';

const list = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'Routine', data: await RoutineService.listForClass(req.classroom!) });
});
const create = catchAsync(async (req, res) => {
  const data = await RoutineService.create(req.classroom!, req.body);
  sendResponse(res, { statusCode: 201, message: 'Class time added', data });
});
const update = catchAsync(async (req, res) => {
  const data = await RoutineService.update(req.classroom!, String(req.params.slotId), req.body);
  sendResponse(res, { message: 'Class time updated', data });
});
const remove = catchAsync(async (req, res) => {
  await RoutineService.remove(req.classroom!, String(req.params.slotId));
  sendResponse(res, { message: 'Class time removed' });
});
const myWeek = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'My weekly routine', data: await RoutineService.myWeek(req.user!) });
});

export const RoutineController = { list, create, update, remove, myWeek };
