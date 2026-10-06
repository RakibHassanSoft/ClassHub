import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { generateJoinCode, normalizeStudentId, studentIdKey } from '../../utils/helpers';
import { UserDocument } from '../user/user.model';
import { RosterEntry } from '../roster/roster.model';
import { AttendanceSession } from '../attendance/attendance.model';
import { RoutineSlot } from '../routine/routine.model';
import { Resource } from '../resource/resource.model';
import { Assessment } from '../marks/marks.model';
import { Notice } from '../notice/notice.model';
import { Classwork, Submission } from '../classwork/classwork.model';
import { Classroom, ClassroomDocument, DEFAULT_REMINDERS } from './class.model';
import { Membership } from './membership.model';
import { ClassDayOff } from '../reminder/reminder.model';
import { Notification } from '../notification/notification.model';
import { User } from '../user/user.model';
import { audit } from '../audit/audit.service';
import { CloneClassInput, CreateClassInput, UpdateClassInput } from './class.validation';

const uniqueJoinCode = async (): Promise<string> => {
  for (let i = 0; i < 10; i += 1) {
    const code = generateJoinCode();
    // eslint-disable-next-line no-await-in-loop
    if (!(await Classroom.exists({ joinCode: code }))) return code;
  }
  throw new ApiError(500, 'Could not generate a join code, please try again');
};

const createClass = async (teacher: UserDocument, input: CreateClassInput) => {
  const { schedule, ...fields } = input;
  const classroom = await Classroom.create({ ...fields, owner: teacher._id, joinCode: await uniqueJoinCode() });
  await Membership.create({ classroom: classroom._id, user: teacher._id, role: 'teacher' });
  if (schedule?.length) {
    await RoutineSlot.insertMany(
      schedule.map((s) => ({ ...s, room: s.room || fields.room, classroom: classroom._id, type: 'theory' as const })),
    );
  }
  return classroom;
};

/** All classes of the user with their role and quick stats. */
const listMyClasses = async (user: UserDocument) => {
  const memberships = await Membership.find({ user: user._id }).lean();
  const classIds = memberships.map((m) => m.classroom);
  if (!classIds.length) return [];

  const [classes, rosterCounts, joinedCounts] = await Promise.all([
    Classroom.find({ _id: { $in: classIds } })
      .populate('owner', 'name email')
      .sort({ archived: 1, updatedAt: -1 })
      .lean(),
    RosterEntry.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { classroom: { $in: classIds } } },
      { $group: { _id: '$classroom', count: { $sum: 1 } } },
    ]),
    Membership.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { classroom: { $in: classIds }, role: 'student' } },
      { $group: { _id: '$classroom', count: { $sum: 1 } } },
    ]),
  ]);

  const roleOf = new Map(memberships.map((m) => [String(m.classroom), m.role]));
  const crOf = new Map(memberships.map((m) => [String(m.classroom), Boolean(m.isCR)]));
  const rosterOf = new Map(rosterCounts.map((r) => [String(r._id), r.count]));
  const joinedOf = new Map(joinedCounts.map((r) => [String(r._id), r.count]));

  return classes.map((c) => {
    const role = roleOf.get(String(c._id));
    return {
      ...c,
      // never leak the join code to students
      joinCode: role === 'teacher' ? c.joinCode : undefined,
      myRole: role,
      isOwner: String((c.owner as unknown as { _id: Types.ObjectId })?._id ?? c.owner) === String(user._id),
      isCR: crOf.get(String(c._id)) ?? false,
      stats: { students: rosterOf.get(String(c._id)) ?? 0, joined: joinedOf.get(String(c._id)) ?? 0 },
    };
  });
};

const getClassDetails = async (classroom: ClassroomDocument, role: string, user?: UserDocument, isCR = false) => {
  await classroom.populate('owner', 'name email institution department');
  const [students, joined] = await Promise.all([
    RosterEntry.countDocuments({ classroom: classroom._id }),
    Membership.countDocuments({ classroom: classroom._id, role: 'student' }),
  ]);
  const data = classroom.toObject() as unknown as Record<string, unknown>;
  if (role !== 'teacher') delete data.joinCode;
  const ownerId = String((classroom.owner as unknown as { _id: Types.ObjectId })?._id ?? classroom.owner);
  return {
    ...data,
    myRole: role,
    isOwner: Boolean(user) && ownerId === String(user!._id),
    isCR,
    stats: { students, joined },
  };
};

const updateClass = async (classroom: ClassroomDocument, input: UpdateClassInput) => {
  const { settings, ...rest } = input;
  classroom.set(rest);
  if (settings) {
    if (settings.attendanceStatuses) {
      classroom.settings.attendanceStatuses = settings.attendanceStatuses.map((s) => ({
        ...s,
        key: s.key.toUpperCase(),
      }));
    }
    if (settings.showAttendanceToStudents !== undefined) {
      classroom.settings.showAttendanceToStudents = settings.showAttendanceToStudents;
    }
    if (settings.lowAttendanceThreshold !== undefined) {
      classroom.settings.lowAttendanceThreshold = settings.lowAttendanceThreshold;
    }
    (['chatEnabled', 'chatTeacherOnly', 'allowStudentDirect'] as const).forEach((k) => {
      if (settings[k] !== undefined) classroom.settings[k] = settings[k];
    });
    if (settings.reminders) {
      const current = classroom.toObject().settings.reminders ?? DEFAULT_REMINDERS;
      classroom.settings.reminders = { ...DEFAULT_REMINDERS, ...current, ...settings.reminders };
      classroom.markModified('settings.reminders');
    }
  }
  await classroom.save();
  return classroom;
};

const resetJoinCode = async (classroom: ClassroomDocument) => {
  classroom.joinCode = await uniqueJoinCode();
  await classroom.save();
  return { joinCode: classroom.joinCode };
};

const deleteClass = async (classroom: ClassroomDocument, user: UserDocument) => {
  if (String(classroom.owner) !== String(user._id)) {
    throw ApiError.forbidden('Only the class owner can delete this class');
  }
  const filter = { classroom: classroom._id };
  await Promise.all([
    Membership.deleteMany(filter),
    RosterEntry.deleteMany(filter),
    AttendanceSession.deleteMany(filter),
    RoutineSlot.deleteMany(filter),
    Resource.deleteMany(filter),
    Assessment.deleteMany(filter),
    Notice.deleteMany(filter),
    Classwork.deleteMany(filter),
    Submission.deleteMany(filter),
    ClassDayOff.deleteMany(filter),
    Notification.deleteMany(filter),
  ]);
  await classroom.deleteOne();
};

/** Public-ish preview shown on the join page. */
const cleanCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Finds the class-list row for this student's register ID ("CSE 221-045" matches "cse221045"). */
const findRosterEntry = async (classId: Types.ObjectId, rawStudentId: string) => {
  const studentId = normalizeStudentId(rawStudentId);
  const exact = await RosterEntry.findOne({ classroom: classId, studentId });
  if (exact) return exact;
  const key = studentIdKey(studentId);
  const candidates = await RosterEntry.find({ classroom: classId }).select('studentId').lean();
  const match = candidates.filter((c) => studentIdKey(c.studentId) === key);
  return match.length === 1 ? RosterEntry.findById(match[0]._id) : null;
};

/** What the student sees before tapping Join (from a code, link or QR). */
const getJoinPreview = async (code: string, user: UserDocument) => {
  const classroom = await Classroom.findOne({ joinCode: cleanCode(code) }).populate('owner', 'name');
  if (!classroom || classroom.archived)
    throw ApiError.notFound('No class found with this code. Check the code and try again.');
  const membership = await Membership.findOne({ classroom: classroom._id, user: user._id });
  const owner = classroom.owner as unknown as { name: string };
  const entry = user.role === 'student' && user.studentId ? await findRosterEntry(classroom._id, user.studentId) : null;
  const takenByOther = Boolean(entry?.claimedBy && String(entry.claimedBy) !== String(user._id));
  return {
    _id: classroom._id,
    title: classroom.title,
    courseCode: classroom.courseCode,
    section: classroom.section,
    semester: classroom.semester,
    color: classroom.color,
    teacher: owner?.name,
    joinEnabled: classroom.joinEnabled,
    alreadyMember: Boolean(membership),
    you: { name: user.name, studentId: user.studentId, role: user.role },
    onList: Boolean(entry),
    canJoin: user.role === 'student' && classroom.joinEnabled && !takenByOther && Boolean(entry),
  };
};

/**
 * Google-Classroom style: the student enters the class code (or scans the QR).
 * Their register ID comes from their account, never typed again.
 * Only register IDs on the teacher's class list can join.
 */
const joinClass = async (code: string, user: UserDocument) => {
  if (user.role !== 'student')
    throw ApiError.forbidden('Only student accounts can join a class. Teachers are added by the class owner.');
  if (!user.studentId) throw ApiError.badRequest('Add your register ID to your profile first.');

  const classroom = await Classroom.findOne({ joinCode: cleanCode(code) });
  if (!classroom || classroom.archived)
    throw ApiError.notFound('No class found with this code. Check the code and try again.');
  if (!classroom.joinEnabled) throw ApiError.forbidden('Joining is turned off for this class. Ask your teacher.');

  const existing = await Membership.findOne({ classroom: classroom._id, user: user._id });
  if (existing) return { classId: classroom._id, alreadyMember: true };

  const entry = await findRosterEntry(classroom._id, user.studentId);
  if (!entry) {
    throw ApiError.forbidden(
      `Your register ID ${user.studentId} is not on this class list. Ask your teacher to add you, then try again.`,
    );
  }
  if (entry.claimedBy && String(entry.claimedBy) !== String(user._id)) {
    throw ApiError.conflict(
      'This register ID is already linked to another account in this class. Contact your teacher.',
    );
  }

  // Claim atomically so two accounts cannot race for the same row.
  const claimed = await RosterEntry.findOneAndUpdate(
    { _id: entry._id, $or: [{ claimedBy: null }, { claimedBy: user._id }] },
    { claimedBy: user._id, claimedAt: new Date() },
    { new: true },
  );
  if (!claimed) throw ApiError.conflict('This register ID was just linked to another account. Contact your teacher.');

  await Membership.create({ classroom: classroom._id, user: user._id, role: 'student', rosterEntry: entry._id });
  return { classId: classroom._id, alreadyMember: false };
};

const leaveClass = async (classroom: ClassroomDocument, user: UserDocument) => {
  const membership = await Membership.findOne({ classroom: classroom._id, user: user._id });
  if (!membership) return;
  if (membership.role === 'teacher' && String(classroom.owner) === String(user._id)) {
    throw ApiError.badRequest('The class owner cannot leave. Delete or archive the class instead.');
  }
  if (membership.rosterEntry) {
    await RosterEntry.updateOne({ _id: membership.rosterEntry }, { claimedBy: null, claimedAt: null });
  }
  await membership.deleteOne();
};

/** Teachers (owner + co-teachers) and, for teachers, every joined student with the CR flag. */
const getPeople = async (classroom: ClassroomDocument, viewerRole: string) => {
  const members = await Membership.find({ classroom: classroom._id })
    .populate('user', 'name email studentId')
    .populate('rosterEntry', 'studentId name')
    .lean();
  const ownerId = String(classroom.owner);
  type U = { _id: Types.ObjectId; name: string; email: string; studentId?: string };
  const teachers = members
    .filter((m) => m.role === 'teacher' && m.user)
    .map((m) => {
      const u = m.user as unknown as U;
      return { _id: u._id, name: u.name, email: u.email, isOwner: String(u._id) === ownerId };
    })
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.name.localeCompare(b.name));
  const students = members
    .filter((m) => m.role === 'student' && m.user)
    .map((m) => {
      const u = m.user as unknown as U;
      const r = m.rosterEntry as unknown as { studentId: string; name: string } | undefined;
      return { _id: u._id, name: r?.name ?? u.name, studentId: r?.studentId ?? u.studentId, isCR: Boolean(m.isCR) };
    })
    .sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
  return {
    teachers,
    representatives: students.filter((s) => s.isCR),
    students: viewerRole === 'teacher' ? students : undefined,
  };
};

const addCoTeacher = async (classroom: ClassroomDocument, actor: UserDocument, email: string) => {
  if (String(classroom.owner) !== String(actor._id)) throw ApiError.forbidden('Only the class owner can add teachers');
  const teacher = await User.findOne({ email: email.toLowerCase().trim() });
  if (!teacher) throw ApiError.notFound('No ClassHub account uses this email. Ask them to sign up as a teacher first.');
  if (teacher.role !== 'teacher') throw ApiError.badRequest('This account is not a teacher account');
  if ((teacher.teacherStatus ?? 'approved') !== 'approved')
    throw ApiError.badRequest('This teacher has not been verified by the admin yet');
  const exists = await Membership.findOne({ classroom: classroom._id, user: teacher._id });
  if (exists)
    throw ApiError.conflict(
      exists.role === 'teacher' ? 'Already a teacher of this class' : 'This person is a student in this class',
    );
  await Membership.create({ classroom: classroom._id, user: teacher._id, role: 'teacher' });
  await audit({
    classroom: classroom._id,
    user: actor._id,
    entity: 'member',
    action: 'create',
    summary: `Added ${teacher.name} as co-teacher`,
  });
  return { _id: teacher._id, name: teacher.name, email: teacher.email, isOwner: false };
};

const removeCoTeacher = async (classroom: ClassroomDocument, actor: UserDocument, userId: string) => {
  if (String(classroom.owner) !== String(actor._id))
    throw ApiError.forbidden('Only the class owner can remove teachers');
  if (userId === String(classroom.owner)) throw ApiError.badRequest('The owner cannot be removed');
  const m = await Membership.findOneAndDelete({ classroom: classroom._id, user: userId, role: 'teacher' }).populate(
    'user',
    'name',
  );
  if (!m) throw ApiError.notFound('Teacher not found in this class');
  await audit({
    classroom: classroom._id,
    user: actor._id,
    entity: 'member',
    action: 'delete',
    summary: `Removed co-teacher ${(m.user as unknown as { name: string })?.name ?? ''}`.trim(),
  });
};

const setRepresentative = async (classroom: ClassroomDocument, actor: UserDocument, userId: string, isCR: boolean) => {
  const m = await Membership.findOneAndUpdate(
    { classroom: classroom._id, user: userId, role: 'student' },
    { isCR },
    { new: true },
  ).populate('user', 'name');
  if (!m) throw ApiError.notFound('Student has not joined this class');
  await audit({
    classroom: classroom._id,
    user: actor._id,
    entity: 'member',
    action: 'update',
    summary: `${isCR ? 'Made' : 'Removed'} ${(m.user as unknown as { name: string })?.name} ${isCR ? 'a class representative' : 'as class representative'}`,
  });
  return { _id: userId, isCR };
};

/** New class from an existing one: copies structure, never students' records or marks. */
const cloneClass = async (source: ClassroomDocument, teacher: UserDocument, input: CloneClassInput) => {
  const { include, ...info } = input;
  const settings = include.settings ? JSON.parse(JSON.stringify(source.settings)) : undefined;
  const classroom = await Classroom.create({
    ...info,
    color: info.color ?? source.color,
    description: info.description ?? source.description,
    room: info.room ?? source.room,
    owner: teacher._id,
    joinCode: await uniqueJoinCode(),
    ...(settings ? { settings } : {}),
  });
  await Membership.create({ classroom: classroom._id, user: teacher._id, role: 'teacher' });

  const copied: Record<string, number> = {};
  if (include.routine) {
    const slots = await RoutineSlot.find({ classroom: source._id }).lean();
    if (slots.length)
      await RoutineSlot.insertMany(
        slots.map(({ _id, createdAt, updatedAt, ...s }) => ({ ...s, classroom: classroom._id })),
      );
    copied.routine = slots.length;
  }
  if (include.resources) {
    const items = await Resource.find({ classroom: source._id }).lean();
    if (items.length) {
      await Resource.insertMany(
        items.map(({ _id, createdAt, updatedAt, ...r }) => ({
          ...r,
          classroom: classroom._id,
          createdBy: teacher._id,
        })),
      );
    }
    copied.resources = items.length;
  }
  if (include.assessments) {
    const items = await Assessment.find({ classroom: source._id }).lean();
    if (items.length) {
      await Assessment.insertMany(
        items.map(({ _id, createdAt, updatedAt, scores, date, ...a }) => ({
          ...a,
          classroom: classroom._id,
          createdBy: teacher._id,
          published: false,
          scores: [],
        })),
      );
    }
    copied.assessments = items.length;
  }
  if (include.roster) {
    const entries = await RosterEntry.find({ classroom: source._id }).lean();
    if (entries.length) {
      await RosterEntry.insertMany(
        entries.map(({ _id, createdAt, updatedAt, claimedBy, claimedAt, ...e }) => ({
          ...e,
          classroom: classroom._id,
          claimedBy: null,
          claimedAt: null,
        })),
      );
    }
    copied.students = entries.length;
  }
  await audit({
    classroom: classroom._id,
    user: teacher._id,
    entity: 'class',
    action: 'create',
    summary: `Created from template "${source.courseCode ? `${source.courseCode} · ` : ''}${source.title}"`,
    changes: Object.entries(copied).map(([k, v]) => ({ label: `Copied ${k}`, to: String(v) })),
  });
  return { classroom, copied };
};

export const ClassService = {
  cloneClass,
  getPeople,
  addCoTeacher,
  removeCoTeacher,
  setRepresentative,
  createClass,
  listMyClasses,
  getClassDetails,
  updateClass,
  resetJoinCode,
  deleteClass,
  getJoinPreview,
  joinClass,
  leaveClass,
};
