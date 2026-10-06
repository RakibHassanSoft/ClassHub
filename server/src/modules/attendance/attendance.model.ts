import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface IAttendanceRecord {
  entry: Types.ObjectId; // RosterEntry
  studentId: string;
  name: string;
  status: string; // key from class settings, '' = not marked
  note?: string;
  checkedInAt?: Date | null; // set when the student checked in themselves
}

export interface IAttendanceSession {
  classroom: Types.ObjectId;
  date: string; // YYYY-MM-DD
  label?: string; // optional, e.g. "Lab" when two sessions share a date
  topic?: string;
  records: IAttendanceRecord[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  checkin?: { secret: string; endsAt: Date; openedBy: Types.ObjectId } | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AttendanceSessionDocument = HydratedDocument<IAttendanceSession>;

const recordSchema = new Schema<IAttendanceRecord>(
  {
    entry: { type: Schema.Types.ObjectId, ref: 'RosterEntry', required: true },
    studentId: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, default: '' },
    note: { type: String, trim: true, maxlength: 200 },
    checkedInAt: { type: Date, default: null },
  },
  { _id: false },
);

const sessionSchema = new Schema<IAttendanceSession>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    date: { type: String, required: true },
    label: { type: String, trim: true, maxlength: 40, default: '' },
    topic: { type: String, trim: true, maxlength: 200 },
    records: { type: [recordSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    checkin: {
      type: { _id: false, secret: String, endsAt: Date, openedBy: Schema.Types.ObjectId },
      default: null,
      select: false,
    },
  },
  { timestamps: true, versionKey: false },
);

sessionSchema.index({ classroom: 1, date: 1, label: 1 }, { unique: true });

export const AttendanceSession = model<IAttendanceSession>('AttendanceSession', sessionSchema);
