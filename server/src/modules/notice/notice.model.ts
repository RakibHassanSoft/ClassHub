import { HydratedDocument, Schema, Types, model } from 'mongoose';

export const NOTICE_TYPES = ['general', 'note', 'cancel', 'reschedule', 'urgent'] as const;

export interface INotice {
  classroom: Types.ObjectId;
  type: (typeof NOTICE_TYPES)[number];
  title: string;
  body?: string;
  link?: string;
  pinned: boolean;
  summary?: string | null; // AI short version of a long notice
  author: Types.ObjectId;
  seenBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type NoticeDocument = HydratedDocument<INotice>;

const noticeSchema = new Schema<INotice>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
    type: { type: String, enum: NOTICE_TYPES, default: 'general' },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    body: { type: String, trim: true, maxlength: 5000 },
    link: { type: String, trim: true, maxlength: 2000 },
    pinned: { type: Boolean, default: false },
    summary: { type: String, default: null },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    seenBy: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  },
  { timestamps: true, versionKey: false },
);

noticeSchema.index({ classroom: 1, createdAt: -1 });

export const Notice = model<INotice>('Notice', noticeSchema);
