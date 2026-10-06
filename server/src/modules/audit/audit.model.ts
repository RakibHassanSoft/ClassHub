import { Schema, Types, model } from 'mongoose';

export const AUDIT_ENTITIES = ['attendance', 'marks', 'roster', 'class', 'notice', 'member'] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export interface IAuditChange {
  label: string; // e.g. "CSE-221-004 Rafiul Islam" or "Date"
  from?: string;
  to?: string;
}

export interface IAuditLog {
  classroom: Types.ObjectId;
  user: Types.ObjectId;
  entity: AuditEntity;
  entityId?: Types.ObjectId;
  action: 'create' | 'update' | 'delete';
  summary: string;
  changes: IAuditChange[];
  createdAt: Date;
}

const auditSchema = new Schema<IAuditLog>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    entity: { type: String, enum: AUDIT_ENTITIES, required: true },
    entityId: { type: Schema.Types.ObjectId },
    action: { type: String, enum: ['create', 'update', 'delete'], required: true },
    summary: { type: String, required: true, maxlength: 300 },
    changes: {
      type: [{ _id: false, label: String, from: String, to: String }],
      default: [],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditSchema.index({ classroom: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditSchema);
