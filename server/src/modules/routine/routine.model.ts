import { HydratedDocument, Schema, Types, model } from 'mongoose';

export const SLOT_TYPES = ['theory', 'lab', 'tutorial', 'other'] as const;

export interface IRoutineSlot {
  classroom: Types.ObjectId;
  day: number; // 0 = Sunday ... 6 = Saturday
  startTime: string; // HH:mm (24h)
  endTime: string;
  room?: string;
  type: (typeof SLOT_TYPES)[number];
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RoutineSlotDocument = HydratedDocument<IRoutineSlot>;

const routineSchema = new Schema<IRoutineSlot>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
    day: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, trim: true, maxlength: 60 },
    type: { type: String, enum: SLOT_TYPES, default: 'theory' },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true, versionKey: false },
);

export const RoutineSlot = model<IRoutineSlot>('RoutineSlot', routineSchema);
