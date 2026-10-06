import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { RosterService } from './roster.service';

const list = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'Class list', data: await RosterService.listRoster(req.classroom!) });
});

const add = catchAsync(async (req, res) => {
  const data = await RosterService.addStudent(req.classroom!, req.body);
  sendResponse(res, { statusCode: 201, message: 'Student added', data });
});

const bulk = catchAsync(async (req, res) => {
  const data = await RosterService.bulkAdd(req.classroom!, req.body, req.user!);
  sendResponse(res, { message: `Imported: ${data.added} added, ${data.updated} updated`, data });
});

const update = catchAsync(async (req, res) => {
  const data = await RosterService.updateStudent(req.classroom!, String(req.params.entryId), req.body);
  sendResponse(res, { message: 'Student updated', data });
});

const remove = catchAsync(async (req, res) => {
  await RosterService.removeStudent(req.classroom!, String(req.params.entryId), req.user!);
  sendResponse(res, { message: 'Student removed' });
});

const unlink = catchAsync(async (req, res) => {
  const data = await RosterService.unlinkAccount(req.classroom!, String(req.params.entryId), req.user!);
  sendResponse(res, { message: 'Account unlinked. The student can join again.', data });
});

const aiExtract = catchAsync(async (req, res) => {
  const data = await RosterService.aiExtract(req.classroom!, req.file);
  sendResponse(res, { message: `Found ${data.students.length} students. Review before saving.`, data });
});

export const RosterController = { list, add, bulk, update, remove, unlink, aiExtract };
