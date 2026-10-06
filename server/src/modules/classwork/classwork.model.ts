import { HydratedDocument, Schema, Types, model } from 'mongoose';
import { attachmentSchema, IAttachment } from '../file/file.model';

/**
 * Everything a teacher posts in "Classwork":
 *  - class_log:     what happened in a class day (topic covered, notes) — the daily diary
 *  - homework:      task with a deadline; students can submit files/text
 *  - class_test:    CT announcement with date and syllabus
 *  - exam_syllabus: mid / final / other exam syllabus notes
 *  - material:      lecture notes, slides, ZIPs, links
 */
export const CLASSWORK_TYPES = ['class_log', 'homework', 'class_test', 'exam_syllabus', 'material'] as const;
export type ClassworkType = (typeof CLASSWORK_TYPES)[number];

export interface IClasswork {
  classroom: Types.ObjectId;
  type: ClassworkType;
  title: string;
  description?: string;
  date?: string; // YYYY-MM-DD: class day (class_log)
  dueAt?: Date | null; // homework deadline
  eventAt?: Date | null; // class test / exam date-time
  examType?: 'mid' | 'final' | 'other';
  allowSubmission: boolean;
  allowLate: boolean;
  maxScore?: number | null;
  links: { url: string; title?: string }[];
  attachments: IAttachment[];
  pinned: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export type ClassworkDocument = HydratedDocument<IClasswork>;

const classworkSchema = new Schema<IClasswork>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
    type: { type: String, enum: CLASSWORK_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 10000 },
    date: { type: String },
    dueAt: { type: Date, default: null },
    eventAt: { type: Date, default: null },
    examType: { type: String, enum: ['mid', 'final', 'other'] },
    allowSubmission: { type: Boolean, default: false },
    allowLate: { type: Boolean, default: true },
    maxScore: { type: Number, default: null, min: 0, max: 1000 },
    links: { type: [{ _id: false, url: String, title: String }], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    pinned: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

classworkSchema.index({ classroom: 1, type: 1, createdAt: -1 });

export const Classwork = model<IClasswork>('Classwork', classworkSchema);

export interface ISubmission {
  classwork: Types.ObjectId;
  classroom: Types.ObjectId;
  student: Types.ObjectId;
  studentId: string;
  name: string;
  text?: string;
  attachments: IAttachment[];
  submittedAt: Date;
  late: boolean;
  score?: number | null;
  feedback?: string;
  gradedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export type SubmissionDocument = HydratedDocument<ISubmission>;

const submissionSchema = new Schema<ISubmission>(
  {
    classwork: { type: Schema.Types.ObjectId, ref: 'Classwork', required: true },
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: String, required: true },
    name: { type: String, required: true },
    text: { type: String, trim: true, maxlength: 5000 },
    attachments: { type: [attachmentSchema], default: [] },
    submittedAt: { type: Date, required: true },
    late: { type: Boolean, default: false },
    score: { type: Number, default: null },
    feedback: { type: String, trim: true, maxlength: 2000 },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
submissionSchema.index({ classwork: 1, student: 1 }, { unique: true });

export const Submission = model<ISubmission>('Submission', submissionSchema);
