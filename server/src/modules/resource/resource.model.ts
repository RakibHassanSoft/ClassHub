import { HydratedDocument, Schema, Types, model } from 'mongoose';
import { attachmentSchema, IAttachment } from '../file/file.model';

export const RESOURCE_KINDS = ['drive', 'link', 'note', 'file'] as const;
export const DRIVE_TYPES = ['folder', 'document', 'spreadsheet', 'presentation', 'form', 'file'] as const;

export interface IResource {
  classroom: Types.ObjectId;
  title: string;
  kind: (typeof RESOURCE_KINDS)[number];
  url?: string;
  driveType?: (typeof DRIVE_TYPES)[number] | null;
  topic?: string;
  description?: string;
  pinned: boolean;
  attachments: IAttachment[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ResourceDocument = HydratedDocument<IResource>;

const resourceSchema = new Schema<IResource>(
  {
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    kind: { type: String, enum: RESOURCE_KINDS, required: true },
    url: { type: String, trim: true, maxlength: 2000 },
    driveType: { type: String, enum: [...DRIVE_TYPES, null], default: null },
    topic: { type: String, trim: true, maxlength: 80, default: 'General' },
    description: { type: String, trim: true, maxlength: 2000 },
    pinned: { type: Boolean, default: false },
    attachments: { type: [attachmentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

export const Resource = model<IResource>('Resource', resourceSchema);
