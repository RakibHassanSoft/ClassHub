import { HydratedDocument, Schema, Types, model } from 'mongoose';

export type MemberRole = 'teacher' | 'student';

export interface IMembership {
  classroom: Types.ObjectId;
  user: Types.ObjectId;
  role: MemberRole;
  rosterEntry?: Types.ObjectId;
  isCR: boolean; // class representative: may post notices and write in teacher-only chat
  createdAt: Date;
}

export type MembershipDocument = HydratedDocument<IMembership>;

const membershipSchema = new Schema<IMembership>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['teacher', 'student'], required: true },
    rosterEntry: { type: Schema.Types.ObjectId, ref: 'RosterEntry' },
    isCR: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

membershipSchema.index({ classroom: 1, user: 1 }, { unique: true });

export const Membership = model<IMembership>('Membership', membershipSchema);
