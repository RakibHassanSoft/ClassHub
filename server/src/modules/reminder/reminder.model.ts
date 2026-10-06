import { Schema, Types, model } from 'mongoose';

/** A cancelled class: the whole day (slot = null) or one routine slot on a date. No reminders are sent for it. */
export interface IClassDayOff {
  classroom: Types.ObjectId;
  date: string; // YYYY-MM-DD in the app time zone
  slot?: Types.ObjectId | null;
  reason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const dayOffSchema = new Schema<IClassDayOff>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
    date: { type: String, required: true },
    slot: { type: Schema.Types.ObjectId, ref: 'RoutineSlot', default: null },
    reason: { type: String, trim: true, maxlength: 300 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

export const ClassDayOff = model<IClassDayOff>('ClassDayOff', dayOffSchema);

/** One row per reminder already sent, so a reminder never goes out twice (also across restarts). */
const reminderLogSchema = new Schema(
  // rows are removed automatically after 45 days (only recent ones are needed to avoid duplicates)
  { key: { type: String, required: true, unique: true }, at: { type: Date, default: () => new Date(), expires: 60 * 60 * 24 * 45 } },
  { versionKey: false },
);

export const ReminderLog = model('ReminderLog', reminderLogSchema);
