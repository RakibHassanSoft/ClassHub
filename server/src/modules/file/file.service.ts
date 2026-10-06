import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { env } from '../../config/env';
import { allowedExtensions, deleteStoredFile, storeFile } from '../../lib/storage';
import { Membership } from '../class/membership.model';
import { UserDocument } from '../user/user.model';
import { FileAsset, IAttachment } from './file.model';

const upload = async (user: UserDocument, file: Express.Multer.File | undefined, classId?: string) => {
  if (!file) throw ApiError.badRequest('Choose a file to upload');
  if (classId) {
    if (!Types.ObjectId.isValid(classId) || !(await Membership.exists({ classroom: classId, user: user._id }))) {
      throw ApiError.forbidden('You are not a member of this class');
    }
  }
  try {
    const stored = await storeFile(file, classId ? `class-${classId}` : `user-${user._id}`);
    return FileAsset.create({ ...stored, owner: user._id, classroom: classId || undefined });
  } catch (err) {
    if ((err as Error).message === 'UNSUPPORTED_TYPE') {
      throw ApiError.badRequest(`This file type is not allowed. Use: ${allowedExtensions.join(' ')}`);
    }
    // eslint-disable-next-line no-console
    console.error('Upload failed:', err);
    throw new ApiError(502, 'Upload failed. Please try again.');
  }
};

/** Turns uploaded file ids into attachments; only the uploader's own files are accepted. */
const toAttachments = async (user: UserDocument, ids: string[] | undefined): Promise<IAttachment[]> => {
  if (!ids?.length) return [];
  const valid = ids.filter((id) => Types.ObjectId.isValid(id));
  const files = await FileAsset.find({ _id: { $in: valid }, owner: user._id }).lean();
  if (files.length !== new Set(valid).size)
    throw ApiError.badRequest('One of the attached files was not found. Upload it again.');
  const byId = new Map(files.map((f) => [String(f._id), f]));
  return valid.map((id) => {
    const f = byId.get(id)!;
    return { file: f._id, url: f.url, name: f.name, size: f.size, mime: f.mime, kind: f.kind };
  });
};

const remove = async (user: UserDocument, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('File not found');
  const f = await FileAsset.findOne({ _id: id, owner: user._id });
  if (!f) throw ApiError.notFound('File not found');
  await deleteStoredFile(f);
  await f.deleteOne();
};

export const FileService = { upload, toAttachments, remove, maxBytes: () => env.maxUploadMb * 1024 * 1024 };
