import { HydratedDocument, Schema, Types, model } from 'mongoose';
import { attachmentSchema, IAttachment } from '../file/file.model';

export interface IConversation {
  type: 'class' | 'direct';
  classroom: Types.ObjectId;
  key: string; // class:<classId> or dm:<classId>:<userA>:<userB>
  participants: Types.ObjectId[]; // direct only
  lastMessage?: { text: string; sender: Types.ObjectId; senderName: string; at: Date } | null;
  createdAt: Date;
  updatedAt: Date;
}
export type ConversationDocument = HydratedDocument<IConversation>;

const conversationSchema = new Schema<IConversation>(
  {
    type: { type: String, enum: ['class', 'direct'], required: true },
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
    key: { type: String, required: true, unique: true },
    participants: { type: [Schema.Types.ObjectId], ref: 'User', default: [], index: true },
    lastMessage: {
      type: { _id: false, text: String, sender: Schema.Types.ObjectId, senderName: String, at: Date },
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

export const Conversation = model<IConversation>('Conversation', conversationSchema);

export type MessageKind = 'text' | 'image' | 'file' | 'poll' | 'classwork';

export interface IPollOption {
  id: string;
  text: string;
  votes: Types.ObjectId[];
}

export interface IMessage {
  conversation: Types.ObjectId;
  classroom: Types.ObjectId;
  sender: Types.ObjectId;
  kind: MessageKind;
  text: string;
  /** card shown in chat when the teacher posts homework, a class test, syllabus or materials */
  ref?: {
    type: string;
    id: Types.ObjectId;
    title: string;
    dueAt?: Date | null;
    eventAt?: Date | null;
    files?: number;
  } | null;
  attachments: IAttachment[];
  replyTo?: { id: Types.ObjectId; senderName: string; text: string; kind: MessageKind } | null;
  poll?: { question: string; options: IPollOption[]; multiple: boolean; closed: boolean } | null;
  summary?: string | null; // AI short version of a long teacher message
  editedAt?: Date | null;
  deleted: boolean;
  createdAt: Date;
}

// "type" is a field name here, so it must be declared as { type: String }
const messageRefSchema = new Schema(
  {
    type: { type: String },
    id: { type: Schema.Types.ObjectId },
    title: { type: String },
    dueAt: { type: Date },
    eventAt: { type: Date },
    files: { type: Number },
  },
  { _id: false },
);

const replySchema = new Schema(
  { id: { type: Schema.Types.ObjectId }, senderName: { type: String }, text: { type: String }, kind: { type: String } },
  { _id: false },
);

const pollSchema = new Schema(
  {
    question: { type: String, required: true, maxlength: 300 },
    options: {
      type: [{ _id: false, id: String, text: { type: String, maxlength: 120 }, votes: { type: [Schema.Types.ObjectId], default: [] } }],
      default: [],
    },
    multiple: { type: Boolean, default: false },
    closed: { type: Boolean, default: false },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['text', 'image', 'file', 'poll', 'classwork'], default: 'text' },
    text: { type: String, maxlength: 4000, default: '' },
    ref: { type: messageRefSchema, default: null },
    attachments: { type: [attachmentSchema], default: [] },
    replyTo: { type: replySchema, default: null },
    poll: { type: pollSchema, default: null },
    summary: { type: String, default: null },
    editedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = model<IMessage>('Message', messageSchema);
export type MessageDocument = HydratedDocument<IMessage>;

/** When a user last read a conversation (one row per user per conversation). */
export interface IChatRead {
  conversation: Types.ObjectId;
  user: Types.ObjectId;
  at: Date;
}

const chatReadSchema = new Schema<IChatRead>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true },
  },
  { versionKey: false },
);
chatReadSchema.index({ conversation: 1, user: 1 }, { unique: true });

export const ChatRead = model<IChatRead>('ChatRead', chatReadSchema);
