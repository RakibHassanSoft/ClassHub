import { HydratedDocument, Schema, Types, model } from 'mongoose';

export type RosterSource = 'manual' | 'csv' | 'ai' | 'self';

export interface IRosterEntry {
  classroom: Types.ObjectId;
  studentId: string;
  name: string;
  email?: string;
  phone?: string;
  section?: string;
  claimedBy?: Types.ObjectId | null;
  claimedAt?: Date | null;
  source: RosterSource;
  createdAt: Date;
  updatedAt: Date;
}

export type RosterEntryDocument = HydratedDocument<IRosterEntry>;

const rosterSchema = new Schema<IRosterEntry>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    studentId: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    section: { type: String, trim: true, maxlength: 30 },
    claimedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    claimedAt: { type: Date, default: null },
    source: { type: String, enum: ['manual', 'csv', 'ai', 'self'], default: 'manual' },
  },
  { timestamps: true, versionKey: false },
);

rosterSchema.index({ classroom: 1, studentId: 1 }, { unique: true });

export const RosterEntry = model<IRosterEntry>('RosterEntry', rosterSchema);
