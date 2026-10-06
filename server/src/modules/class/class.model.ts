import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface AttendanceStatusOption {
  key: string; // short code shown in the grid, e.g. "P"
  label: string; // e.g. "Present"
  countsAsPresent: boolean;
  color: string; // ui colour token: emerald | rose | amber | sky | violet | slate
}

export const DEFAULT_ATTENDANCE_STATUSES: AttendanceStatusOption[] = [
  { key: 'P', label: 'Present', countsAsPresent: true, color: 'emerald' },
  { key: 'A', label: 'Absent', countsAsPresent: false, color: 'rose' },
  { key: 'L', label: 'Late', countsAsPresent: true, color: 'amber' },
  { key: 'E', label: 'Excused', countsAsPresent: true, color: 'sky' },
];

export const CLASS_COLORS = ['emerald', 'teal', 'cyan', 'sky', 'indigo', 'violet', 'rose', 'amber'] as const;

/** Automatic class reminders (sent by the server scheduler in the app time zone). */
export interface ReminderSettings {
  enabled: boolean;
  nightBefore: boolean; // evening message about tomorrow's classes, deadlines and tests
  nightTime: string; // HH:mm
  beforeClass: boolean; // "starts in 1 hour"
  minutesBefore: number;
  notifyTeachers: boolean; // teachers get the same reminders
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: true,
  nightBefore: true,
  nightTime: '21:00',
  beforeClass: true,
  minutesBefore: 60,
  notifyTeachers: true,
};

export interface IClassroom {
  title: string;
  courseCode?: string;
  section?: string;
  semester?: string;
  description?: string;
  room?: string;
  color: (typeof CLASS_COLORS)[number];
  owner: Types.ObjectId;
  joinCode: string;
  joinEnabled: boolean;
  archived: boolean;
  settings: {
    attendanceStatuses: AttendanceStatusOption[];
    showAttendanceToStudents: boolean;
    lowAttendanceThreshold: number; // percent
    chatEnabled: boolean;
    chatTeacherOnly: boolean; // only teachers can post in the class group
    allowStudentDirect: boolean; // students can message teachers privately
    reminders: ReminderSettings;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type ClassroomDocument = HydratedDocument<IClassroom>;

const statusSchema = new Schema<AttendanceStatusOption>(
  {
    key: { type: String, required: true, trim: true, maxlength: 3 },
    label: { type: String, required: true, trim: true, maxlength: 24 },
    countsAsPresent: { type: Boolean, default: true },
    color: { type: String, default: 'slate' },
  },
  { _id: false },
);

const classroomSchema = new Schema<IClassroom>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    courseCode: { type: String, trim: true, maxlength: 30 },
    section: { type: String, trim: true, maxlength: 30 },
    semester: { type: String, trim: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 1000 },
    room: { type: String, trim: true, maxlength: 60 },
    color: { type: String, enum: CLASS_COLORS, default: 'emerald' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    joinCode: { type: String, required: true, unique: true, uppercase: true },
    joinEnabled: { type: Boolean, default: true },
    archived: { type: Boolean, default: false },
    settings: {
      attendanceStatuses: { type: [statusSchema], default: () => DEFAULT_ATTENDANCE_STATUSES },
      showAttendanceToStudents: { type: Boolean, default: true },
      lowAttendanceThreshold: { type: Number, default: 75, min: 0, max: 100 },
      chatEnabled: { type: Boolean, default: true },
      chatTeacherOnly: { type: Boolean, default: false },
      allowStudentDirect: { type: Boolean, default: true },
      reminders: {
        enabled: { type: Boolean, default: true },
        nightBefore: { type: Boolean, default: true },
        nightTime: { type: String, default: '21:00' },
        beforeClass: { type: Boolean, default: true },
        minutesBefore: { type: Number, default: 60, min: 5, max: 720 },
        notifyTeachers: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true, versionKey: false },
);

export const Classroom = model<IClassroom>('Classroom', classroomSchema);
