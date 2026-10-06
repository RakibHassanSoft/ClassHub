import { Router } from 'express';
import { z } from 'zod';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { ChatService } from './chat.service';
import { contactsSchema, listMessagesSchema, sendRichSchema, startDirectSchema, voteSchema } from './chat.validation';

const router = Router();
router.use(auth());

router.get(
  '/conversations',
  catchAsync(async (req, res) => {
    sendResponse(res, { message: 'Conversations', data: await ChatService.listForUser(req.user!) });
  }),
);

router.get(
  '/class/:classId',
  catchAsync(async (req, res) => {
    sendResponse(res, {
      message: 'Class chat',
      data: await ChatService.getClassConversation(req.user!, String(req.params.classId)),
    });
  }),
);

router.get(
  '/contacts',
  validate(contactsSchema, 'query'),
  catchAsync(async (req, res) => {
    const { classId } = req.query as unknown as z.infer<typeof contactsSchema>;
    sendResponse(res, { message: 'Contacts', data: await ChatService.contacts(req.user!, classId) });
  }),
);

router.post(
  '/direct',
  validate(startDirectSchema),
  catchAsync(async (req, res) => {
    const data = await ChatService.startDirect(req.user!, req.body.classId, req.body.userId);
    sendResponse(res, { message: 'Conversation ready', data });
  }),
);

router.get(
  '/conversations/:id',
  catchAsync(async (req, res) => {
    const { conversation, classroom, role, isCR } = await ChatService.access(req.user!._id, String(req.params.id));
    await conversation.populate('participants', 'name role studentId');
    sendResponse(res, {
      message: 'Conversation',
      data: {
        _id: conversation._id,
        type: conversation.type,
        participants: conversation.participants,
        classroom: {
          _id: classroom._id,
          title: classroom.title,
          courseCode: classroom.courseCode,
          color: classroom.color,
        },
        myRole: role,
        canPoll: role === 'teacher' || isCR,
        canPost:
          !classroom.archived &&
          (conversation.type === 'direct' ||
            (classroom.settings.chatEnabled && (!classroom.settings.chatTeacherOnly || role === 'teacher' || isCR))),
      },
    });
  }),
);

router.get(
  '/conversations/:id/messages',
  validate(listMessagesSchema, 'query'),
  catchAsync(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listMessagesSchema>;
    sendResponse(res, { message: 'Messages', data: await ChatService.messages(req.user!, String(req.params.id), q) });
  }),
);

router.post(
  '/conversations/:id/messages',
  validate(sendRichSchema),
  catchAsync(async (req, res) => {
    const data = await ChatService.send(req.user!, String(req.params.id), req.body);
    sendResponse(res, { statusCode: 201, message: 'Sent', data });
  }),
);

router.post(
  '/conversations/:id/read',
  catchAsync(async (req, res) => {
    await ChatService.access(req.user!._id, String(req.params.id));
    await ChatService.markRead(req.user!._id, String(req.params.id));
    sendResponse(res, { message: 'Marked as read' });
  }),
);

router.post(
  '/messages/:messageId/vote',
  validate(voteSchema),
  catchAsync(async (req, res) => {
    const data = await ChatService.vote(req.user!, String(req.params.messageId), req.body.optionIds);
    sendResponse(res, { message: 'Vote saved', data });
  }),
);

router.post(
  '/messages/:messageId/close-poll',
  catchAsync(async (req, res) => {
    const data = await ChatService.closePoll(req.user!, String(req.params.messageId));
    sendResponse(res, { message: 'Poll closed', data });
  }),
);

router.delete(
  '/messages/:messageId',
  catchAsync(async (req, res) => {
    await ChatService.deleteMessage(req.user!, String(req.params.messageId));
    sendResponse(res, { message: 'Message deleted' });
  }),
);

export const ChatRoutes = router;
