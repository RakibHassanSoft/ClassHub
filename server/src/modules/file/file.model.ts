import { HydratedDocument, Schema, Types, model } from 'mongoose';
import { FileKind } from '../../lib/storage';

export interface IFileAsset {
  owner: Types.ObjectId;
  classroom?: Types.ObjectId;
  url: string;
  publicId: string;
  provider: 'cloudinary' | 'local';
  resourceType?: string;
  name: string;
  size: number;
  mime: string;
  kind: FileKind;
  createdAt: Date;
}
export type FileAssetDocument = HydratedDocument<IFileAsset>;

const fileSchema = new Schema<IFileAsset>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    classroom: { type: Schema.Types.ObjectId, ref: 'Classroom' },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    provider: { type: String, enum: ['cloudinary', 'local'], required: true },
    resourceType: String,
    name: { type: String, required: true },
    size: { type: Number, required: true },
    mime: { type: String, required: true },
    kind: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

export const FileAsset = model<IFileAsset>('FileAsset', fileSchema);

/** The copy of a file stored inside posts/messages (no lookups needed to show it). */
export interface IAttachment {
  file: Types.ObjectId;
  url: string;
  name: string;
  size: number;
  mime: string;
  kind: FileKind;
}

export const attachmentSchema = new Schema<IAttachment>(
  {
    file: { type: Schema.Types.ObjectId, ref: 'FileAsset', required: true },
    url: { type: String, required: true },
    name: { type: String, required: true },
    size: Number,
    mime: String,
    kind: String,
  },
  { _id: false },
);
