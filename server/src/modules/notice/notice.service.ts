import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ClassroomDocument } from '../class/class.model';
import { Membership, MemberRole } from '../class/membership.model';
import { UserDocument } from '../user/user.model';
import { Notice } from './notice.model';
import { emitToUsers } from '../../lib/socket';
import { mailEnabled, sendMail } from '../../lib/mailer';
import { env } from '../../config/env';
import { PushService } from '../push/push.service';
import { User } from '../user/user.model';
import { audit } from '../audit/audit.service';
import { aiEnabled, summarize } from '../../lib/ai';
import { NoticeDocument } from './notice.model';
import { NotificationService } from '../notification/notification.service';

const SUMMARY_MIN_CHARS = 280;

/** Long notices get a short AI summary in the background so students see the point first. */
const addSummaryLater = (classroom: ClassroomDocument, notice: NoticeDocument) => {
  if (!aiEnabled() || (notice.body ?? '').length < SUMMARY_MIN_CHARS) return;
  summarize(`${notice.title}\n\n${notice.body}`)
    .then(async (summary) => {
      if (!summary) return;
      await Notice.updateOne({ _id: notice._id }, { $set: { summary } });
      const members = await Membership.find({ classroom: classroom._id }).select('user').lean();
      emitToUsers(members.map((m) => String(m.user)), 'notice:updated', {
        classId: String(classroom._id),
        noticeId: String(notice._id),
        summary,
      });
    })
    .catch(() => undefined);
};
import { CreateNoticeInput, UpdateNoticeInput } from './notice.validation';

type LeanNotice = {
  _id: Types.ObjectId;
  seenBy: Types.ObjectId[];
  [key: string]: unknown;
};

const shape = (n: LeanNotice, userId: Types.ObjectId, role: MemberRole | undefined) => {
  const { seenBy, ...rest } = n;
  return {
    ...rest,
    seen: seenBy.some((id) => String(id) === String(userId)),
    ...(role === 'teacher' ? { seenCount: seenBy.length } : {}),
  };
};

const list = async (classroom: ClassroomDocument, user: UserDocument, role: MemberRole) => {
  const notices = await Notice.find({ classroom: classroom._id })
    .populate('author', 'name')
    .sort({ pinned: -1, createdAt: -1 })
    .limit(200)
    .lean();
  return notices.map((n) => shape(n as unknown as LeanNotice, user._id, role));
};

const TYPE_LABEL: Record<string, string> = {
  general: 'Announcement',
  note: 'Note',
  cancel: 'Class cancelled',
  reschedule: 'Class rescheduled',
  urgent: 'URGENT',
};

/** Posts a notice and tells every member: live in the app, phone push, and email when urgent. */
const create = async (classroom: ClassroomDocument, user: UserDocument, input: CreateNoticeInput) => {
  const notice = await Notice.create({ ...input, classroom: classroom._id, author: user._id, seenBy: [user._id] });

  const members = await Membership.find({ classroom: classroom._id, user: { $ne: user._id } })
    .select('user role')
    .lean();
  const audience = members.map((m) => String(m.user));
  const className = classroom.courseCode || classroom.title;
  const type = notice.type;

  emitToUsers(audience, 'notice:new', {
    classId: String(classroom._id),
    noticeId: String(notice._id),
    title: notice.title,
    type,
    className,
  });

  const delivery = { push: 0, email: 0 };
  const pushResult = await PushService.sendToUsers(audience, {
    title: `${TYPE_LABEL[type] ?? 'Notice'} · ${className}`,
    body: notice.title + (notice.body ? ` — ${notice.body.slice(0, 120)}` : ''),
    url: `/classes/${classroom._id}`,
    tag: `notice-${notice._id}`,
    urgent: type === 'urgent' || type === 'cancel',
  });
  delivery.push = pushResult.sent;

  if ((type === 'urgent' || type === 'cancel') && mailEnabled()) {
    const students = await User.find({ _id: { $in: members.map((m) => m.user) } })
      .select('email')
      .lean();
    const res = await sendMail({
      bcc: students.map((s) => s.email).filter((e): e is string => Boolean(e)),
      subject: `[${className}] ${TYPE_LABEL[type]}: ${notice.title}`,
      heading: notice.title,
      body: notice.body,
      actionUrl: `${env.appUrl}/classes/${classroom._id}`,
      actionLabel: 'Open class',
    });
    if (res.sent) delivery.email = students.length;
  }
  addSummaryLater(classroom, notice);
  return { notice, delivery };
};

const findOne = async (classroom: ClassroomDocument, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Notice not found');
  const doc = await Notice.findOne({ _id: id, classroom: classroom._id });
  if (!doc) throw ApiError.notFound('Notice not found');
  return doc;
};

/** A class representative may only change their own notices. */
const assertCanManage = (doc: { author: Types.ObjectId }, user?: UserDocument, role?: MemberRole) => {
  if (user && role !== 'teacher' && String(doc.author) !== String(user._id)) {
    throw ApiError.forbidden('You can only change notices you posted');
  }
};

const update = async (
  classroom: ClassroomDocument,
  id: string,
  input: UpdateNoticeInput,
  user?: UserDocument,
  role?: MemberRole,
) => {
  const doc = await findOne(classroom, id);
  assertCanManage(doc, user, role);
  const bodyChanged = input.body !== undefined && input.body !== doc.body;
  doc.set(input);
  if (bodyChanged) doc.summary = null;
  await doc.save();
  if (bodyChanged) addSummaryLater(classroom, doc);
  return doc;
};

const remove = async (classroom: ClassroomDocument, id: string, user?: UserDocument, role?: MemberRole) => {
  const doc = await findOne(classroom, id);
  assertCanManage(doc, user, role);
  await doc.deleteOne();
  if (user) {
    await audit({
      classroom: classroom._id,
      user: user._id,
      entity: 'notice',
      entityId: doc._id,
      action: 'delete',
      summary: `Deleted notice "${doc.title}"`,
    });
  }
};

const markSeen = async (classroom: ClassroomDocument, user: UserDocument, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Notice not found');
  await Notice.updateOne({ _id: id, classroom: classroom._id }, { $addToSet: { seenBy: user._id } });
};

/** Latest notices from all classes of the user (dashboard + bell). */
const feed = async (user: UserDocument, limit = 30) => {
  const memberships = await Membership.find({ user: user._id }).select('classroom role').lean();
  const roleOf = new Map(memberships.map((m) => [String(m.classroom), m.role]));
  const notices = await Notice.find({ classroom: { $in: memberships.map((m) => m.classroom) } })
    .populate('classroom', 'title courseCode color')
    .populate('author', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const noticeItems = notices.map((n) => {
    const classId = String((n.classroom as unknown as { _id: Types.ObjectId })?._id ?? n.classroom);
    return shape(n as unknown as LeanNotice, user._id, roleOf.get(classId));
  });
  // personal reminders ("class in 1 hour", "tomorrow") appear in the same feed
  const reminders = (await NotificationService.listForUser(user._id, limit)).map((r) => ({
    _id: r._id,
    kind: 'reminder' as const,
    type: 'reminder',
    reminderKind: r.kind,
    classroom: r.classroom,
    title: r.title,
    body: r.body,
    link: r.url,
    pinned: false,
    seen: r.read,
    createdAt: r.createdAt,
  }));
  const when = (i: object) => new Date(String((i as { createdAt?: unknown }).createdAt)).getTime();
  const items = [...noticeItems, ...reminders]
    .sort((a, b) => when(b) - when(a))
    .slice(0, limit);
  return { items, unread: items.filter((i) => !i.seen).length };
};

const markAllSeen = async (user: UserDocument) => {
  await NotificationService.markAllRead(user._id);
  const memberships = await Membership.find({ user: user._id }).select('classroom').lean();
  await Notice.updateMany(
    { classroom: { $in: memberships.map((m) => m.classroom) }, seenBy: { $ne: user._id } },
    { $addToSet: { seenBy: user._id } },
  );
};

export const NoticeService = { list, create, update, remove, markSeen, feed, markAllSeen };
