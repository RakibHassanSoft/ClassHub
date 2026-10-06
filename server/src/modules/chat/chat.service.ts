import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { conversationRoom, emitToUsers, getIO, isUserOnline } from '../../lib/socket';
import { Classroom, ClassroomDocument } from '../class/class.model';
import { Membership } from '../class/membership.model';
import { PushService } from '../push/push.service';
import { UserDocument } from '../user/user.model';
import { aiEnabled, summarize } from '../../lib/ai';
import { IAttachment } from '../file/file.model';
import { FileService } from '../file/file.service';
import { User } from '../user/user.model';
import { ChatRead, Conversation, ConversationDocument, IMessage, Message, MessageDocument, MessageKind } from './chat.model';

const sid = (v: unknown) => String(v);

const ensureClassConversation = async (classId: Types.ObjectId) =>
  Conversation.findOneAndUpdate(
    { key: `class:${classId}` },
    { $setOnInsert: { type: 'class', classroom: classId, key: `class:${classId}`, participants: [] } },
    { upsert: true, new: true },
  );

interface Access {
  conversation: ConversationDocument;
  classroom: ClassroomDocument;
  role: 'teacher' | 'student';
  isCR: boolean;
}

/** Loads a conversation and checks that the user may read it. */
const access = async (userId: Types.ObjectId | string, conversationId: string): Promise<Access> => {
  if (!Types.ObjectId.isValid(conversationId)) throw ApiError.notFound('Conversation not found');
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  const [classroom, membership] = await Promise.all([
    Classroom.findById(conversation.classroom),
    Membership.findOne({ classroom: conversation.classroom, user: userId }),
  ]);
  if (!classroom || !membership) throw ApiError.forbidden('You are not a member of this class');
  if (conversation.type === 'direct' && !(conversation.participants ?? []).some((p) => sid(p) === sid(userId))) {
    throw ApiError.forbidden('This conversation is private');
  }
  if (conversation.type === 'class' && !classroom.settings.chatEnabled && membership.role !== 'teacher') {
    throw ApiError.forbidden('Chat is turned off for this class');
  }
  return { conversation, classroom, role: membership.role, isCR: Boolean(membership.isCR) };
};

export const canJoinConversation = async (userId: string, conversationId: string) => {
  try {
    await access(userId, conversationId);
    return true;
  } catch {
    return false;
  }
};

const audienceOf = async (conversation: ConversationDocument) => {
  if (conversation.type === 'direct') return conversation.participants.map(sid);
  const members = await Membership.find({ classroom: conversation.classroom }).select('user').lean();
  return members.map((m) => sid(m.user));
};

/** All conversations of the user: class groups (one per class) + private chats. */
const listForUser = async (user: UserDocument) => {
  const memberships = await Membership.find({ user: user._id }).lean();
  const classes = await Classroom.find({ _id: { $in: memberships.map((m) => m.classroom) }, archived: false })
    .select('title courseCode section color settings')
    .lean();
  const roleOf = new Map(memberships.map((m) => [sid(m.classroom), m.role]));

  const visibleClasses = classes.filter(
    (c) => c.settings?.chatEnabled !== false || roleOf.get(sid(c._id)) === 'teacher',
  );
  await Promise.all(visibleClasses.map((c) => ensureClassConversation(c._id)));

  const conversations = await Conversation.find({
    $or: [
      { type: 'class', classroom: { $in: visibleClasses.map((c) => c._id) } },
      { type: 'direct', participants: user._id, classroom: { $in: classes.map((c) => c._id) } },
    ],
  })
    .populate('participants', 'name role studentId')
    .lean();

  const classById = new Map(classes.map((c) => [sid(c._id), c]));

  const reads = await ChatRead.find({ user: user._id, conversation: { $in: conversations.map((c) => c._id) } }).lean();
  const readOf = new Map(reads.map((r) => [sid(r.conversation), r.at]));

  const items = await Promise.all(
    conversations.map(async (c) => {
      const unread = await Message.countDocuments({
        conversation: c._id,
        createdAt: { $gt: readOf.get(sid(c._id)) ?? new Date(0) },
        sender: { $ne: user._id },
        deleted: false,
      });
      const cls = classById.get(sid(c.classroom));
      const other =
        c.type === 'direct'
          ? (
              c.participants as unknown as { _id: Types.ObjectId; name: string; role: string; studentId?: string }[]
            ).find((p) => sid(p._id) !== sid(user._id))
          : undefined;
      return {
        _id: c._id,
        type: c.type,
        classroom: cls
          ? { _id: cls._id, title: cls.title, courseCode: cls.courseCode, section: cls.section, color: cls.color }
          : null,
        title:
          c.type === 'class'
            ? cls?.courseCode
              ? `${cls.courseCode} · ${cls.title}`
              : cls?.title
            : (other?.name ?? 'Conversation'),
        other: other ? { _id: other._id, name: other.name, role: other.role, studentId: other.studentId } : undefined,
        myRole: roleOf.get(sid(c.classroom)),
        teacherOnly: c.type === 'class' ? Boolean(cls?.settings?.chatTeacherOnly) : false,
        lastMessage: c.lastMessage,
        unread,
        updatedAt: c.lastMessage?.at ?? c.createdAt,
      };
    }),
  );

  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return { items, unread: items.reduce((t, i) => t + i.unread, 0) };
};

const getClassConversation = async (user: UserDocument, classId: string) => {
  if (!Types.ObjectId.isValid(classId)) throw ApiError.notFound('Class not found');
  const membership = await Membership.findOne({ classroom: classId, user: user._id });
  if (!membership) throw ApiError.forbidden('You are not a member of this class');
  const conversation = await ensureClassConversation(new Types.ObjectId(classId));
  return { _id: conversation._id };
};

/** People the user can start a private chat with in a class. */
const contacts = async (user: UserDocument, classId: string) => {
  const membership = await Membership.findOne({ classroom: classId, user: user._id });
  if (!membership) throw ApiError.forbidden('You are not a member of this class');
  const classroom = await Classroom.findById(classId).lean();
  if (!classroom) throw ApiError.notFound('Class not found');
  if (membership.role === 'student' && !classroom.settings.allowStudentDirect) return [];
  const members = await Membership.find(
    membership.role === 'teacher'
      ? { classroom: classId, user: { $ne: user._id } }
      : { classroom: classId, role: 'teacher' as const },
  )
    .populate('user', 'name role studentId email')
    .lean();
  return members
    .map((m) => m.user as unknown as { _id: Types.ObjectId; name: string; role: string; studentId?: string })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
};

const startDirect = async (user: UserDocument, classId: string, otherId: string) => {
  if (sid(user._id) === otherId) throw ApiError.badRequest('You cannot message yourself');
  const [classroom, mine, theirs] = await Promise.all([
    Classroom.findById(classId),
    Membership.findOne({ classroom: classId, user: user._id }),
    Membership.findOne({ classroom: classId, user: otherId }),
  ]);
  if (!classroom || !mine || !theirs) throw ApiError.forbidden('Both people must be members of this class');
  if (mine.role === 'student' && theirs.role !== 'teacher')
    throw ApiError.forbidden('Students can message their teachers only');
  if (mine.role === 'student' && !classroom.settings.allowStudentDirect) {
    throw ApiError.forbidden('Private messages are turned off for this class');
  }
  const pair = [sid(user._id), otherId].sort();
  const key = `dm:${classId}:${pair[0]}:${pair[1]}`;
  const conversation = await Conversation.findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        type: 'direct',
        classroom: classroom._id,
        key,
        participants: pair.map((p) => new Types.ObjectId(p)),
      },
    },
    { upsert: true, new: true },
  );
  return { _id: conversation._id };
};

const messages = async (user: UserDocument, conversationId: string, opts: { before?: string; limit: number }) => {
  const { conversation } = await access(user._id, conversationId);
  const filter: Record<string, unknown> = { conversation: conversation._id };
  if (opts.before) filter.createdAt = { $lt: new Date(opts.before) };
  const rows = await Message.find(filter)
    .populate('sender', 'name role')
    .sort({ createdAt: -1 })
    .limit(opts.limit + 1)
    .lean();
  const hasMore = rows.length > opts.limit;
  return {
    items: rows
      .slice(0, opts.limit)
      .reverse()
      .map((m) =>
        m.deleted ? { ...m, text: '', attachments: [], poll: null, summary: null, replyTo: null } : m,
      ),
    hasMore,
    reads: await readStates(conversation._id, user._id),
  };
};

const markRead = async (userId: Types.ObjectId, conversationId: string) => {
  const at = new Date();
  await ChatRead.updateOne({ conversation: conversationId, user: userId }, { $set: { at } }, { upsert: true });
  const conversation = await Conversation.findById(conversationId);
  if (conversation) {
    emitToUsers(await audienceOf(conversation), 'conversation:read', {
      conversationId: sid(conversationId),
      userId: sid(userId),
      at,
    });
  }
};

/** Read times of the other people in a conversation (for WhatsApp-style ticks). */
const readStates = async (conversationId: Types.ObjectId, exceptUser: Types.ObjectId) => {
  const rows = await ChatRead.find({ conversation: conversationId, user: { $ne: exceptUser } }).lean();
  return rows.map((r) => ({ user: sid(r.user), at: r.at }));
};

const previewOf = (m: { kind: MessageKind; text: string; attachments?: IAttachment[]; poll?: { question: string } | null }) => {
  if (m.kind === 'poll') return `Poll: ${m.poll?.question ?? ''}`;
  if (m.kind === 'image') return m.text ? `Photo · ${m.text}` : m.attachments && m.attachments.length > 1 ? `${m.attachments.length} photos` : 'Photo';
  if (m.kind === 'file') return m.text ? `File · ${m.text}` : `File · ${m.attachments?.[0]?.name ?? 'document'}`;
  return m.text;
};

const SUMMARY_MIN_CHARS = 280;

/** Creates a short AI version of a long teacher message in the background. */
const addSummaryLater = (message: MessageDocument, conversation: ConversationDocument) => {
  if (!aiEnabled()) return;
  summarize(message.text)
    .then(async (summary) => {
      if (!summary) return;
      await Message.updateOne({ _id: message._id }, { $set: { summary } });
      emitToUsers(await audienceOf(conversation), 'message:updated', {
        conversationId: sid(conversation._id),
        messageId: sid(message._id),
        patch: { summary },
      });
    })
    .catch(() => undefined);
};

interface SendInput {
  text?: string;
  attachmentIds?: string[];
  replyTo?: string;
  poll?: { question: string; options: string[]; multiple?: boolean };
}

const send = async (user: UserDocument, conversationId: string, input: SendInput | string) => {
  const body: SendInput = typeof input === 'string' ? { text: input } : input;
  const text = (body.text ?? '').trim();
  const { conversation, classroom, role, isCR } = await access(user._id, conversationId);
  if (conversation.type === 'class') {
    if (!classroom.settings.chatEnabled) throw ApiError.forbidden('Chat is turned off for this class');
    if (classroom.settings.chatTeacherOnly && role !== 'teacher' && !isCR)
      throw ApiError.forbidden('Only teachers can post in this class chat');
  }
  if (classroom.archived) throw ApiError.forbidden('This class is archived');

  if (body.poll && role !== 'teacher' && !isCR) throw ApiError.forbidden('Only teachers and class representatives can create polls');
  const attachments = body.poll ? [] : await FileService.toAttachments(user, body.attachmentIds);
  if (!text && !attachments.length && !body.poll) throw ApiError.badRequest('Message is empty');

  let replyTo: IMessage['replyTo'] = null;
  if (body.replyTo) {
    const original = await Message.findOne({ _id: body.replyTo, conversation: conversation._id }).lean();
    if (original && !original.deleted) {
      replyTo = {
        id: original._id,
        senderName: (await User.findById(original.sender).select('name').lean())?.name ?? 'Someone',
        text: previewOf(original).slice(0, 160),
        kind: original.kind,
      };
    }
  }

  const kind: MessageKind = body.poll
    ? 'poll'
    : attachments.length && attachments.every((a) => a.kind === 'image')
      ? 'image'
      : attachments.length
        ? 'file'
        : 'text';

  const message = await Message.create({
    conversation: conversation._id,
    classroom: classroom._id,
    sender: user._id,
    kind,
    text: body.poll ? '' : text,
    attachments,
    replyTo,
    poll: body.poll
      ? {
          question: body.poll.question.trim(),
          options: body.poll.options.map((o, i) => ({ id: `o${i + 1}`, text: o.trim(), votes: [] })),
          multiple: Boolean(body.poll.multiple),
          closed: false,
        }
      : null,
  });
  const preview = previewOf(message);
  conversation.lastMessage = { text: preview.slice(0, 200), sender: user._id, senderName: user.name, at: message.createdAt };
  await conversation.save();
  await ChatRead.updateOne(
    { conversation: conversation._id, user: user._id },
    { $set: { at: message.createdAt } },
    { upsert: true },
  );

  const payload = {
    conversationId: sid(conversation._id),
    message: { ...message.toObject(), sender: { _id: user._id, name: user.name, role: user.role } },
  };
  const audience = await audienceOf(conversation);
  emitToUsers(audience, 'message:new', payload);

  if (role === 'teacher' && kind === 'text' && text.length >= SUMMARY_MIN_CHARS) addSummaryLater(message, conversation);

  // Phone notification when the person is not online in the app (all private messages; teacher posts / polls in groups)
  const notifyGroup = conversation.type === 'class' && (role === 'teacher' || kind === 'poll');
  if (conversation.type === 'direct' || notifyGroup) {
    const others = audience.filter((u) => u !== sid(user._id));
    const offline = (await Promise.all(others.map(async (u) => ((await isUserOnline(u)) ? null : u)))).filter(
      Boolean,
    ) as string[];
    PushService.sendToUsers(offline, {
      title: `${user.name} · ${classroom.courseCode || classroom.title}`,
      body: preview.slice(0, 140),
      url: `/messages/${conversation._id}`,
      tag: `chat-${conversation._id}`,
    }).catch(() => undefined);
  }
  return payload.message;
};

const loadPollMessage = async (user: UserDocument, messageId: string) => {
  if (!Types.ObjectId.isValid(messageId)) throw ApiError.notFound('Poll not found');
  const message = await Message.findById(messageId);
  if (!message || message.kind !== 'poll' || !message.poll || message.deleted) throw ApiError.notFound('Poll not found');
  const acc = await access(user._id, sid(message.conversation));
  return { message, ...acc };
};

const emitPoll = async (conversation: ConversationDocument, message: MessageDocument) => {
  emitToUsers(await audienceOf(conversation), 'message:updated', {
    conversationId: sid(conversation._id),
    messageId: sid(message._id),
    patch: { poll: message.toObject().poll },
  });
};

/** Sets the user's vote(s). An empty list removes the vote. */
const vote = async (user: UserDocument, messageId: string, optionIds: string[]) => {
  const { message, conversation } = await loadPollMessage(user, messageId);
  const poll = message.poll!;
  if (poll.closed) throw ApiError.badRequest('This poll is closed');
  const valid = new Set(poll.options.map((o) => o.id));
  const chosen = [...new Set(optionIds)].filter((id) => valid.has(id));
  if (chosen.length !== new Set(optionIds).size) throw ApiError.badRequest('Invalid poll option');
  if (!poll.multiple && chosen.length > 1) throw ApiError.badRequest('You can choose only one option');
  const me = sid(user._id);
  poll.options.forEach((o) => {
    const others = o.votes.filter((v) => sid(v) !== me);
    o.votes = chosen.includes(o.id) ? [...others, user._id] : others;
  });
  message.markModified('poll');
  await message.save();
  await emitPoll(conversation, message);
  return message.toObject().poll;
};

const closePoll = async (user: UserDocument, messageId: string) => {
  const { message, conversation, role } = await loadPollMessage(user, messageId);
  if (sid(message.sender) !== sid(user._id) && role !== 'teacher') throw ApiError.forbidden('Only the poll creator can close it');
  message.poll!.closed = true;
  message.markModified('poll');
  await message.save();
  await emitPoll(conversation, message);
  return message.toObject().poll;
};

const deleteMessage = async (user: UserDocument, messageId: string) => {
  if (!Types.ObjectId.isValid(messageId)) throw ApiError.notFound('Message not found');
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  const { conversation, role } = await access(user._id, sid(message.conversation));
  if (sid(message.sender) !== sid(user._id) && role !== 'teacher')
    throw ApiError.forbidden('You can only delete your own messages');
  message.deleted = true;
  message.text = '';
  message.attachments = [];
  message.poll = null;
  message.summary = null;
  await message.save();
  getIO()
    ?.to(conversationRoom(sid(conversation._id)))
    .emit('message:deleted', { conversationId: sid(conversation._id), messageId });
  emitToUsers(await audienceOf(conversation), 'message:deleted', { conversationId: sid(conversation._id), messageId });
};

/** Posts an automatic card into the class group chat (e.g. new homework). Never throws. */
const postClassCard = async (
  classroom: ClassroomDocument,
  sender: UserDocument,
  card: {
    text: string;
    ref: {
      type: string;
      id: Types.ObjectId;
      title: string;
      dueAt?: Date | null;
      eventAt?: Date | null;
      files?: number;
    };
  },
) => {
  try {
    if (!classroom.settings.chatEnabled) return;
    const conversation = await ensureClassConversation(classroom._id);
    const message = await Message.create({
      conversation: conversation._id,
      classroom: classroom._id,
      sender: sender._id,
      kind: 'classwork',
      text: card.text,
      ref: card.ref,
    });
    conversation.lastMessage = {
      text: card.text.slice(0, 200),
      sender: sender._id,
      senderName: sender.name,
      at: message.createdAt,
    };
    await conversation.save();
    emitToUsers(await audienceOf(conversation), 'message:new', {
      conversationId: sid(conversation._id),
      message: { ...message.toObject(), sender: { _id: sender._id, name: sender.name, role: sender.role } },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Chat card failed:', (err as Error).message);
  }
};

export const ChatService = {
  postClassCard,
  listForUser,
  getClassConversation,
  contacts,
  startDirect,
  messages,
  markRead,
  send,
  vote,
  closePoll,
  readStates,
  deleteMessage,
  access,
};
