import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { MarksService } from './marks.service';

const sheet = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'Marks sheet', data: await MarksService.getSheet(req.classroom!) });
});
const mine = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'My marks', data: await MarksService.getMine(req.classroom!, req.membership!) });
});
const create = catchAsync(async (req, res) => {
  const data = await MarksService.create(req.classroom!, req.user!, req.body);
  sendResponse(res, { statusCode: 201, message: 'Assessment added', data });
});
const update = catchAsync(async (req, res) => {
  const data = await MarksService.update(req.classroom!, String(req.params.assessmentId), req.body, req.user!);
  sendResponse(res, { message: 'Assessment updated', data });
});
const remove = catchAsync(async (req, res) => {
  await MarksService.remove(req.classroom!, String(req.params.assessmentId), req.user!);
  sendResponse(res, { message: 'Assessment deleted' });
});
const saveScores = catchAsync(async (req, res) => {
  await MarksService.saveScores(req.classroom!, String(req.params.assessmentId), req.body, req.user!);
  sendResponse(res, { message: 'Marks saved' });
});

export const MarksController = { sheet, mine, create, update, remove, saveScores };
