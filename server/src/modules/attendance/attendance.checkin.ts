import crypto from 'crypto';
import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { emitToUsers } from '../../lib/socket';
import { ClassroomDocument } from '../class/class.model';
import { Membership, MembershipDocument } from '../class/membership.model';
import { UserDocument } from '../user/user.model';
import { AttendanceSession } from './attendance.model';
import { audit } from '../audit/audit.service';
import { prettyDate } from '../../utils/helpers';

/** Codes change every STEP seconds; the previous code is still accepted (slow typists, clock drift). */
export const CHECKIN_STEP_SECONDS = 30;

const codeAt = (secret: string, step: number) => {
  const h = crypto.createHmac('sha256', secret).update(String(step)).digest();
  return String(h.readUInt32BE(0) % 10000).padStart(4, '0');
};
const currentStep = (now = Date.now()) => Math.floor(now / 1000 / CHECKIN_STEP_SECONDS);

const presentKey = (classroom: ClassroomDocument) =>
  classroom.settings.attendanceStatuses.find((s) => s.key === 'P' && s.countsAsPresent)?.key ??
  classroom.settings.attendanceStatuses.find((s) => s.countsAsPresent)?.key ??
  'P';

const findWithCheckin = async (classroom: ClassroomDocument, sessionId: string) => {
  if (!Types.ObjectId.isValid(sessionId)) throw ApiError.notFound('Attendance not found');
  const session = await AttendanceSession.findOne({ _id: sessionId, classroom: classroom._id }).select('+checkin');
  if (!session) throw ApiError.notFound('Attendance not found');
  return session;
};

const isOpen = (s: { checkin?: { endsAt: Date } | null }) =>
  Boolean(s.checkin && s.checkin.endsAt.getTime() > Date.now());

const studentAudience = async (classroom: ClassroomDocument) =>
  (await Membership.find({ classroom: classroom._id, role: 'student' }).select('user').lean()).map((m) =>
    String(m.user),
  );
const teacherAudience = async (classroom: ClassroomDocument) =>
  (await Membership.find({ classroom: classroom._id, role: 'teacher' }).select('user').lean()).map((m) =>
    String(m.user),
  );

const start = async (classroom: ClassroomDocument, user: UserDocument, sessionId: string, minutes: number) => {
  const session = await findWithCheckin(classroom, sessionId);
  session.checkin = {
    secret: crypto.randomBytes(24).toString('hex'),
    endsAt: new Date(Date.now() + minutes * 60_000),
    openedBy: user._id,
  };
  await session.save();
  emitToUsers(await studentAudience(classroom), 'checkin:open', {
    classId: String(classroom._id),
    sessionId: String(session._id),
    className: classroom.courseCode || classroom.title,
    endsAt: session.checkin.endsAt,
  });
  await audit({
    classroom: classroom._id,
    user: user._id,
    entity: 'attendance',
    entityId: session._id,
    action: 'update',
    summary: `Opened self check-in for ${prettyDate(session.date)} (${minutes} min)`,
  });
  return status(classroom, sessionId, true);
};

const stop = async (classroom: ClassroomDocument, sessionId: string) => {
  const session = await findWithCheckin(classroom, sessionId);
  session.checkin = null;
  await session.save();
  emitToUsers(await studentAudience(classroom), 'checkin:closed', { classId: String(classroom._id), sessionId });
  return status(classroom, sessionId, true);
};

/** Teacher view includes the live code; students only learn whether it is open. */
const status = async (classroom: ClassroomDocument, sessionId: string, asTeacher: boolean) => {
  const session = await findWithCheckin(classroom, sessionId);
  const open = isOpen(session);
  const step = currentStep();
  const nowMs = Date.now();
  return {
    sessionId: session._id,
    date: session.date,
    label: session.label,
    open,
    endsAt: open ? session.checkin!.endsAt : null,
    code: asTeacher && open ? codeAt(session.checkin!.secret, step) : undefined,
    stepSeconds: CHECKIN_STEP_SECONDS,
    codeExpiresIn: CHECKIN_STEP_SECONDS - Math.floor((nowMs / 1000) % CHECKIN_STEP_SECONDS),
    checkedIn: asTeacher
      ? session.records
          .filter((r) => r.checkedInAt)
          .sort((a, b) => b.checkedInAt!.getTime() - a.checkedInAt!.getTime())
          .map((r) => ({ entry: r.entry, studentId: r.studentId, name: r.name, at: r.checkedInAt }))
      : undefined,
    total: session.records.length,
  };
};

/** The open check-in for a class (students use this to show the banner). */
const active = async (classroom: ClassroomDocument, membership: MembershipDocument) => {
  const session = await AttendanceSession.findOne({ classroom: classroom._id, 'checkin.endsAt': { $gt: new Date() } })
    .select('+checkin')
    .sort({ 'checkin.endsAt': -1 });
  if (!session) return null;
  const mine = membership.rosterEntry
    ? session.records.find((r) => String(r.entry) === String(membership.rosterEntry))
    : undefined;
  return {
    sessionId: session._id,
    date: session.date,
    label: session.label,
    endsAt: session.checkin!.endsAt,
    checkedIn: Boolean(mine?.checkedInAt),
  };
};

const checkIn = async (
  classroom: ClassroomDocument,
  membership: MembershipDocument,
  user: UserDocument,
  sessionId: string,
  code: string,
) => {
  if (membership.role !== 'student' || !membership.rosterEntry)
    throw ApiError.forbidden('Only students on the class list can check in');
  const session = await findWithCheckin(classroom, sessionId);
  if (!isOpen(session)) throw ApiError.badRequest('Check-in is closed for this class');
  const step = currentStep();
  const valid = [codeAt(session.checkin!.secret, step), codeAt(session.checkin!.secret, step - 1)];
  if (!valid.includes(code.trim()))
    throw ApiError.badRequest('Wrong or expired code. Look at the board for the current code.');

  const entryId = String(membership.rosterEntry);
  let record = session.records.find((r) => String(r.entry) === entryId);
  if (record?.checkedInAt) return { alreadyCheckedIn: true, at: record.checkedInAt };

  const key = presentKey(classroom);
  const now = new Date();
  if (record) {
    record.status = key;
    record.checkedInAt = now;
  } else {
    // student was added to the class after the sheet was created
    const { RosterEntry } = await import('../roster/roster.model');
    const entry = await RosterEntry.findById(entryId).lean();
    if (!entry) throw ApiError.forbidden('You are not on this class list');
    session.records.push({
      entry: entry._id,
      studentId: entry.studentId,
      name: entry.name,
      status: key,
      checkedInAt: now,
    });
    record = session.records.at(-1);
  }
  session.markModified('records');
  await session.save();

  emitToUsers(await teacherAudience(classroom), 'checkin:new', {
    classId: String(classroom._id),
    sessionId,
    entry: String(record!.entry),
    studentId: record!.studentId,
    name: record!.name,
    at: now,
  });
  return { alreadyCheckedIn: false, at: now, student: user.name };
};

export const CheckinService = { start, stop, status, active, checkIn };
