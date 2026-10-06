import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { NoticeService } from './notice.service';

const list = catchAsync(async (req, res) => {
  const data = await NoticeService.list(req.classroom!, req.user!, req.membership!.role);
  sendResponse(res, { message: 'Notices', data });
});
const create = catchAsync(async (req, res) => {
  const { notice, delivery } = await NoticeService.create(req.classroom!, req.user!, req.body);
  sendResponse(res, { statusCode: 201, message: 'Notice posted', data: notice, meta: { delivery } });
});
const update = catchAsync(async (req, res) => {
  const data = await NoticeService.update(
    req.classroom!,
    String(req.params.noticeId),
    req.body,
    req.user!,
    req.membership!.role,
  );
  sendResponse(res, { message: 'Notice updated', data });
});
const remove = catchAsync(async (req, res) => {
  await NoticeService.remove(req.classroom!, String(req.params.noticeId), req.user!, req.membership!.role);
  sendResponse(res, { message: 'Notice deleted' });
});
const seen = catchAsync(async (req, res) => {
  await NoticeService.markSeen(req.classroom!, req.user!, String(req.params.noticeId));
  sendResponse(res, { message: 'Marked as seen' });
});
const feed = catchAsync(async (req, res) => {
  sendResponse(res, { message: 'Notice feed', data: await NoticeService.feed(req.user!) });
});
const seenAll = catchAsync(async (req, res) => {
  await NoticeService.markAllSeen(req.user!);
  sendResponse(res, { message: 'All notices marked as seen' });
});

export const NoticeController = { list, create, update, remove, seen, feed, seenAll };
