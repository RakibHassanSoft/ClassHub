import { HydratedDocument, Schema, Types, model } from 'mongoose';

export const ASSESSMENT_CATEGORIES = [
  'quiz',
  'assignment',
  'mid',
  'final',
  'lab',
  'presentation',
  'project',
  'other',
] as const;

export interface IScore {
  entry: Types.ObjectId; // RosterEntry
  studentId: string;
  score: number | null;
  remarks?: string;
}

export interface IAssessment {
  classroom: Types.ObjectId;
  name: string;
  category: (typeof ASSESSMENT_CATEGORIES)[number];
  maxMarks: number;
  weight?: number | null; // optional contribution to final total, in percent
  date?: string;
  published: boolean;
  scores: IScore[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type AssessmentDocument = HydratedDocument<IAssessment>;

const scoreSchema = new Schema<IScore>(
  {
    entry: { type: Schema.Types.ObjectId, ref: 'RosterEntry', required: true },
    studentId: { type: String, required: true },
    score: { type: Number, default: null },
    remarks: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);

const assessmentSchema = new Schema<IAssessment>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, enum: ASSESSMENT_CATEGORIES, default: 'other' },
    maxMarks: { type: Number, required: true, min: 0.5, max: 1000 },
    weight: { type: Number, min: 0, max: 100, default: null },
    date: { type: String },
    published: { type: Boolean, default: false },
    scores: { type: [scoreSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

export const Assessment = model<IAssessment>('Assessment', assessmentSchema);
