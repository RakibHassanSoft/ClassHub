import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ClassroomDocument } from '../class/class.model';
import { UserDocument } from '../user/user.model';
import { Resource } from './resource.model';
import { FileService } from '../file/file.service';
import { ChatService } from '../chat/chat.service';
import { Membership } from '../class/membership.model';
import { emitToUsers } from '../../lib/socket';
import { detectDriveType } from './resource.utils';
import { CreateResourceInput, UpdateResourceInput } from './resource.validation';

const resolveKind = (url?: string, kind?: string) => {
  if (kind === 'note') return { kind: 'note' as const, driveType: null };
  if (kind === 'file') return { kind: 'file' as const, driveType: null };
  const driveType = url ? detectDriveType(url) : null;
  return { kind: driveType ? ('drive' as const) : ('link' as const), driveType };
};

const list = (classroom: ClassroomDocument) =>
  Resource.find({ classroom: classroom._id }).populate('createdBy', 'name').sort({ pinned: -1, createdAt: -1 }).lean();

const create = async (classroom: ClassroomDocument, user: UserDocument, input: CreateResourceInput) => {
  const { attachmentIds, ...rest } = input;
  const attachments = await FileService.toAttachments(user, attachmentIds);
  const doc = await Resource.create({
    ...rest,
    ...resolveKind(input.url, input.kind),
    url: input.kind === 'file' ? undefined : input.url,
    attachments,
    topic: input.topic || 'General',
    classroom: classroom._id,
    createdBy: user._id,
  });
  const students = (await Membership.find({ classroom: classroom._id, role: 'student' }).select('user').lean()).map(
    (m) => String(m.user),
  );
  emitToUsers(students, 'classwork:new', {
    classId: String(classroom._id),
    id: String(doc._id),
    type: 'material',
    title: doc.title,
    className: classroom.courseCode || classroom.title,
  });
  if (input.notifyChat !== false) {
    await ChatService.postClassCard(classroom, user, {
      text: `Material: ${doc.title}`,
      ref: { type: 'material', id: doc._id, title: doc.title, files: attachments.length },
    });
  }
  return doc;
};

const findOne = async (classroom: ClassroomDocument, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Resource not found');
  const doc = await Resource.findOne({ _id: id, classroom: classroom._id });
  if (!doc) throw ApiError.notFound('Resource not found');
  return doc;
};

const update = async (classroom: ClassroomDocument, id: string, input: UpdateResourceInput) => {
  const doc = await findOne(classroom, id);
  const { attachmentIds: _ignored, notifyChat: _n, ...changes } = input;
  doc.set(changes);
  if (input.url !== undefined || input.kind !== undefined) {
    const { kind, driveType } = resolveKind(doc.url, input.kind ?? doc.kind);
    doc.kind = kind;
    doc.driveType = driveType;
  }
  if (doc.kind !== 'note' && doc.kind !== 'file' && !doc.url) throw ApiError.badRequest('Paste the Google Drive link');
  await doc.save();
  return doc;
};

const remove = async (classroom: ClassroomDocument, id: string) => {
  const doc = await findOne(classroom, id);
  await doc.deleteOne();
};

export const ResourceService = { list, create, update, remove };
