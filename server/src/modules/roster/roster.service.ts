import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { normalizeStudentId } from '../../utils/helpers';
import { ClassroomDocument } from '../class/class.model';
import { Membership } from '../class/membership.model';
import { extractRosterWithAI } from './roster.ai';
import { RosterEntry } from './roster.model';
import { BulkRosterInput, RosterRowInput } from './roster.validation';
import { audit } from '../audit/audit.service';
import { UserDocument } from '../user/user.model';

const listRoster = (classroom: ClassroomDocument) =>
  RosterEntry.find({ classroom: classroom._id }).populate('claimedBy', 'name email').sort({ studentId: 1 }).lean();

const addStudent = async (classroom: ClassroomDocument, input: RosterRowInput) => {
  const studentId = normalizeStudentId(input.studentId);
  const exists = await RosterEntry.exists({ classroom: classroom._id, studentId });
  if (exists) throw ApiError.conflict(`Student ID ${studentId} is already on this class list`);
  return RosterEntry.create({ ...input, studentId, classroom: classroom._id, source: 'manual' });
};

const bulkAdd = async (classroom: ClassroomDocument, input: BulkRosterInput, user?: UserDocument) => {
  // de-duplicate inside the uploaded file (last row wins)
  const byId = new Map<string, RosterRowInput>();
  input.rows.forEach((r) => {
    const id = normalizeStudentId(r.studentId);
    if (id) byId.set(id, { ...r, studentId: id });
  });

  const existing = await RosterEntry.find({ classroom: classroom._id, studentId: { $in: [...byId.keys()] } })
    .select('studentId')
    .lean();
  const existingIds = new Set(existing.map((e) => e.studentId));

  const ops = [...byId.values()]
    .filter((r) => input.onDuplicate === 'update' || !existingIds.has(r.studentId))
    .map((r) => ({
      updateOne: {
        filter: { classroom: classroom._id, studentId: r.studentId },
        update: {
          $set: { name: r.name, email: r.email, phone: r.phone, section: r.section },
          $setOnInsert: { classroom: classroom._id, studentId: r.studentId, source: input.source },
        },
        upsert: true,
      },
    }));

  const result = ops.length ? await RosterEntry.bulkWrite(ops, { ordered: false }) : null;
  if (user && result) {
    await audit({
      classroom: classroom._id,
      user: user._id,
      entity: 'roster',
      action: 'create',
      summary: `Imported ${input.rows.length} students (${input.source.toUpperCase()}): ${result.upsertedCount} new`,
    });
  }
  const added = result?.upsertedCount ?? 0;
  const updated = input.onDuplicate === 'update' ? [...byId.keys()].filter((id) => existingIds.has(id)).length : 0;
  const skipped = input.rows.length - added - updated;
  return { added, updated, skipped, total: await RosterEntry.countDocuments({ classroom: classroom._id }) };
};

const getEntry = async (classroom: ClassroomDocument, entryId: string) => {
  if (!Types.ObjectId.isValid(entryId)) throw ApiError.notFound('Student not found');
  const entry = await RosterEntry.findOne({ _id: entryId, classroom: classroom._id });
  if (!entry) throw ApiError.notFound('Student not found');
  return entry;
};

const updateStudent = async (classroom: ClassroomDocument, entryId: string, input: Partial<RosterRowInput>) => {
  const entry = await getEntry(classroom, entryId);
  if (input.studentId) {
    const newId = normalizeStudentId(input.studentId);
    if (newId !== entry.studentId) {
      const clash = await RosterEntry.exists({ classroom: classroom._id, studentId: newId });
      if (clash) throw ApiError.conflict(`Student ID ${newId} is already on this class list`);
      input.studentId = newId;
    }
  }
  entry.set(input);
  await entry.save();
  return entry;
};

const removeStudent = async (classroom: ClassroomDocument, entryId: string, user?: UserDocument) => {
  const entry = await getEntry(classroom, entryId);
  await Membership.deleteOne({ classroom: classroom._id, rosterEntry: entry._id });
  await entry.deleteOne();
  if (user) {
    await audit({
      classroom: classroom._id,
      user: user._id,
      entity: 'roster',
      entityId: entry._id,
      action: 'delete',
      summary: `Removed ${entry.studentId} ${entry.name} from the class list`,
    });
  }
};

/** Frees the ID so a different account can join with it (e.g. student made a new account). */
const unlinkAccount = async (classroom: ClassroomDocument, entryId: string, user?: UserDocument) => {
  const entry = await getEntry(classroom, entryId);
  if (user) {
    await audit({
      classroom: classroom._id,
      user: user._id,
      entity: 'member',
      entityId: entry._id,
      action: 'update',
      summary: `Unlinked the account of ${entry.studentId} ${entry.name}`,
    });
  }
  await Membership.deleteOne({ classroom: classroom._id, rosterEntry: entry._id });
  entry.claimedBy = null;
  entry.claimedAt = null;
  await entry.save();
  return entry;
};

const aiExtract = async (classroom: ClassroomDocument, file?: Express.Multer.File) => {
  if (!file) throw ApiError.badRequest('Please choose a file to upload');
  const existing = await RosterEntry.find({ classroom: classroom._id }).select('studentId').lean();
  return extractRosterWithAI(file, new Set(existing.map((e) => e.studentId)));
};

export const RosterService = {
  listRoster,
  addStudent,
  bulkAdd,
  updateStudent,
  removeStudent,
  unlinkAccount,
  aiExtract,
};
