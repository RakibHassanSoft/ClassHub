import { Schema, Types, model } from 'mongoose';

export const NOTIFICATION_KINDS = ['class_soon', 'tomorrow', 'reminder_test', 'account'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** A personal notification (class reminders). Shown in the bell together with class notices. */
export interface INotification {
  user: Types.ObjectId;
  classroom?: Types.ObjectId;
  kind: NotificationKind;
  title: string;
  body?: string;
  url?: string;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom' },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 2000 },
    url: { type: String, maxlength: 500 },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
notificationSchema.index({ user: 1, createdAt: -1 });
// old reminders are deleted automatically after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Notification = model<INotification>('Notification', notificationSchema);
