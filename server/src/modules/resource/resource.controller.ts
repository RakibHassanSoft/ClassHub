import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { ResourceService } from './resource.service';

const list = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'Resources', data: await ResourceService.list(req.classroom!) });
});
const create = catchAsync(async (req, res) => {
  const data = await ResourceService.create(req.classroom!, req.user!, req.body);
  sendResponse(res, { statusCode: 201, message: 'Resource shared', data });
});
const update = catchAsync(async (req, res) => {
  const data = await ResourceService.update(req.classroom!, String(req.params.resourceId), req.body);
  sendResponse(res, { message: 'Resource updated', data });
});
const remove = catchAsync(async (req, res) => {
  await ResourceService.remove(req.classroom!, String(req.params.resourceId));
  sendResponse(res, { message: 'Resource removed' });
});

export const ResourceController = { list, create, update, remove };
