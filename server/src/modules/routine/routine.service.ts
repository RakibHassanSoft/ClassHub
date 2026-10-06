import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ClassroomDocument } from '../class/class.model';
import { Membership } from '../class/membership.model';
import { UserDocument } from '../user/user.model';
import { RoutineSlot } from './routine.model';
import { CreateSlotInput, UpdateSlotInput } from './routine.validation';

const listForClass = (classroom: ClassroomDocument) =>
  RoutineSlot.find({ classroom: classroom._id }).sort({ day: 1, startTime: 1 }).lean();

const create = (classroom: ClassroomDocument, input: CreateSlotInput) =>
  RoutineSlot.create({ ...input, classroom: classroom._id });

const findSlot = async (classroom: ClassroomDocument, slotId: string) => {
  if (!Types.ObjectId.isValid(slotId)) throw ApiError.notFound('Class time not found');
  const slot = await RoutineSlot.findOne({ _id: slotId, classroom: classroom._id });
  if (!slot) throw ApiError.notFound('Class time not found');
  return slot;
};

const update = async (classroom: ClassroomDocument, slotId: string, input: UpdateSlotInput) => {
  const slot = await findSlot(classroom, slotId);
  slot.set(input);
  if (slot.endTime <= slot.startTime) throw ApiError.badRequest('End time must be after start time');
  await slot.save();
  return slot;
};

const remove = async (classroom: ClassroomDocument, slotId: string) => {
  const slot = await findSlot(classroom, slotId);
  await slot.deleteOne();
};

/** Weekly timetable across every active class the user belongs to. */
const myWeek = async (user: UserDocument) => {
  const memberships = await Membership.find({ user: user._id }).select('classroom').lean();
  const slots = await RoutineSlot.find({ classroom: { $in: memberships.map((m) => m.classroom) } })
    .populate({ path: 'classroom', select: 'title courseCode section color archived' })
    .sort({ day: 1, startTime: 1 })
    .lean();
  return slots.filter((s) => {
    const c = s.classroom as unknown as { archived?: boolean } | null;
    return c && !c.archived;
  });
};

export const RoutineService = { listForClass, create, update, remove, myWeek };
