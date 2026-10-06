import { Types } from 'mongoose';
import { emitToUsers } from '../../lib/socket';
import { PushService } from '../push/push.service';
import { Notification, NotificationKind } from './notification.model';

interface NotifyInput {
  kind: NotificationKind;
  classroom?: Types.ObjectId | string;
  title: string;
  body?: string;
  url?: string;
  urgent?: boolean;
  tag?: string;
}

/** Saves a personal notification for each user, shows it live in the app and sends a phone push. */
const notifyUsers = async (userIds: (string | Types.ObjectId)[], input: NotifyInput) => {
  const ids = [...new Set(userIds.map(String))];
  if (!ids.length) return { saved: 0, push: 0 };
  await Notification.insertMany(
    ids.map((user) => ({
      user,
      classroom: input.classroom,
      kind: input.kind,
      title: input.title,
      body: input.body,
      url: input.url,
    })),
  );
  emitToUsers(ids, 'notification:new', {
    kind: input.kind,
    classId: input.classroom ? String(input.classroom) : undefined,
    title: input.title,
    body: input.body,
    url: input.url,
  });
  const push = await PushService.sendToUsers(ids, {
    title: input.title,
    body: (input.body ?? '').replace(/\n+/g, ' · ').slice(0, 220),
    url: input.url ?? '/notifications',
    tag: input.tag,
    urgent: input.urgent,
  }).catch(() => ({ sent: 0 }));
  return { saved: ids.length, push: push.sent };
};

const listForUser = (userId: Types.ObjectId, limit = 30) =>
  Notification.find({ user: userId }).populate('classroom', 'title courseCode color').sort({ createdAt: -1 }).limit(limit).lean();

const markAllRead = (userId: Types.ObjectId) => Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });

const markRead = (userId: Types.ObjectId, id: string) =>
  Types.ObjectId.isValid(id) ? Notification.updateOne({ _id: id, user: userId }, { $set: { read: true } }) : null;

export const NotificationService = { notifyUsers, listForUser, markAllRead, markRead };
