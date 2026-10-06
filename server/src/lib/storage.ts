import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../config/env';

export type FileKind = 'image' | 'pdf' | 'doc' | 'sheet' | 'slides' | 'archive' | 'text' | 'other';

export interface StoredFile {
  url: string;
  publicId: string;
  provider: 'cloudinary' | 'local';
  resourceType?: string;
  name: string;
  size: number;
  mime: string;
  kind: FileKind;
}

/** Allowed uploads for an education app: documents, images and archives. No video/audio/executables. */
const ALLOWED: Record<string, FileKind> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
  'application/vnd.ms-excel': 'sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
  'text/csv': 'sheet',
  'application/vnd.ms-powerpoint': 'slides',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slides',
  'text/plain': 'text',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/vnd.rar': 'archive',
  'application/x-7z-compressed': 'archive',
};
const BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Browsers often send octet-stream for zip/rar; fall back to the file extension. */
export const resolveMime = (name: string, mime: string) => {
  if (ALLOWED[mime]) return mime;
  return BY_EXT[path.extname(name).toLowerCase()] ?? mime;
};
export const kindOf = (mime: string): FileKind | null => ALLOWED[mime] ?? null;
export const allowedExtensions = Object.keys(BY_EXT);

export const cloudinaryEnabled = () =>
  Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

let configured = false;
const configureCloudinary = () => {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
  configured = true;
};

const safeName = (name: string) =>
  path
    .basename(name)
    .replace(/[^\w.\- ()]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(-120) || 'file';

/** Saves a file to Cloudinary when configured, otherwise to local disk. */
export const storeFile = async (
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  folder: string,
): Promise<StoredFile> => {
  const name = safeName(Buffer.from(file.originalname, 'latin1').toString('utf8'));
  const mime = resolveMime(name, file.mimetype);
  const kind = kindOf(mime);
  if (!kind) throw new Error('UNSUPPORTED_TYPE');

  if (cloudinaryEnabled()) {
    configureCloudinary();
    // images as "image" (thumbnails, resizing); everything else as "raw" so PDFs/ZIPs are always downloadable
    const resourceType = kind === 'image' ? 'image' : 'raw';
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${env.cloudinary.folder}/${folder}`,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
          filename_override: name,
        },
        (err, res) => (err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res)),
      );
      stream.end(file.buffer);
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      provider: 'cloudinary',
      resourceType,
      name,
      size: file.size,
      mime,
      kind,
    };
  }

  const dir = path.resolve(env.uploadDir, folder);
  await fs.mkdir(dir, { recursive: true });
  const key = `${crypto.randomBytes(12).toString('hex')}-${name.replace(/ /g, '_')}`;
  await fs.writeFile(path.join(dir, key), file.buffer);
  const rel = `${folder}/${key}`;
  return {
    url: `${env.publicApiUrl}/uploads/${rel.split('/').map(encodeURIComponent).join('/')}`,
    publicId: rel,
    provider: 'local',
    name,
    size: file.size,
    mime,
    kind,
  };
};

export const deleteStoredFile = async (f: Pick<StoredFile, 'provider' | 'publicId' | 'resourceType'>) => {
  try {
    if (f.provider === 'cloudinary' && cloudinaryEnabled()) {
      configureCloudinary();
      await cloudinary.uploader.destroy(f.publicId, { resource_type: f.resourceType ?? 'raw' });
    } else if (f.provider === 'local') {
      const full = path.resolve(env.uploadDir, f.publicId);
      if (full.startsWith(path.resolve(env.uploadDir))) await fs.unlink(full);
    }
  } catch {
    /* already gone */
  }
};
