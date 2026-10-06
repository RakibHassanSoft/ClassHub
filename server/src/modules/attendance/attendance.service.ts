import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { prettyDate } from '../../utils/helpers';
import { ClassroomDocument } from '../class/class.model';
import { MembershipDocument } from '../class/membership.model';
import { UserDocument } from '../user/user.model';
import { RosterEntry } from '../roster/roster.model';
import { AttendanceSession, IAttendanceRecord } from './attendance.model';
import { CreateSessionInput, UpdateSessionInput } from './attendance.validation';
import { audit } from '../audit/audit.service';
import { IAuditChange } from '../audit/audit.model';

const statusKeys = (classroom: ClassroomDocument) => new Set(classroom.settings.attendanceStatuses.map((s) => s.key));
const presentKeys = (classroom: ClassroomDocument) =>
  new Set(classroom.settings.attendanceStatuses.filter((s) => s.countsAsPresent).map((s) => s.key));

const assertStatus = (classroom: ClassroomDocument, status: string) => {
  if (status !== '' && !statusKeys(classroom).has(status.toUpperCase())) {
    throw ApiError.badRequest(`Unknown attendance status "${status}"`);
  }
};

const percent = (present: number, total: number) => (total ? Math.round((present / total) * 1000) / 10 : null);

/** Teacher view: every session as a column, every student as a row. */
const getRegister = async (classroom: ClassroomDocument) => {
  const [roster, sessions] = await Promise.all([
    RosterEntry.find({ classroom: classroom._id }).sort({ studentId: 1 }).lean(),
    AttendanceSession.find({ classroom: classroom._id }).sort({ date: 1, label: 1 }).lean(),
  ]);
  const present = presentKeys(classroom);

  const summary: Record<string, { present: number; total: number; percent: number | null }> = {};
  roster.forEach((r) => {
    summary[String(r._id)] = { present: 0, total: 0, percent: null };
  });

  const sessionList = sessions.map((s) => {
    const marks: Record<string, string> = {};
    const counts: Record<string, number> = {};
    s.records.forEach((rec) => {
      const id = String(rec.entry);
      marks[id] = rec.status;
      if (rec.status) counts[rec.status] = (counts[rec.status] ?? 0) + 1;
      const sum = summary[id];
      if (sum && rec.status) {
        sum.total += 1;
        if (present.has(rec.status)) sum.present += 1;
      }
    });
    return { _id: s._id, date: s.date, label: s.label, topic: s.topic, counts, marks, updatedAt: s.updatedAt };
  });

  Object.values(summary).forEach((s) => {
    s.percent = percent(s.present, s.total);
  });

  return {
    statuses: classroom.settings.attendanceStatuses,
    threshold: classroom.settings.lowAttendanceThreshold,
    students: roster.map((r) => ({ _id: r._id, studentId: r.studentId, name: r.name, joined: Boolean(r.claimedBy) })),
    sessions: sessionList,
    summary,
  };
};

const createSession = async (classroom: ClassroomDocument, user: UserDocument, input: CreateSessionInput) => {
  const defaultStatus = (input.defaultStatus ?? '').toUpperCase();
  assertStatus(classroom, defaultStatus);

  const duplicate = await AttendanceSession.exists({
    classroom: classroom._id,
    date: input.date,
    label: input.label ?? '',
  });
  if (duplicate) {
    throw ApiError.conflict('Attendance for this date already exists. Add a label (e.g. "Lab") to take a second one.');
  }

  const roster = await RosterEntry.find({ classroom: classroom._id }).sort({ studentId: 1 }).lean();
  if (!roster.length) throw ApiError.badRequest('Add students to the class list before taking attendance');

  const session = await AttendanceSession.create({
    classroom: classroom._id,
    date: input.date,
    label: input.label ?? '',
    topic: input.topic,
    createdBy: user._id,
    records: roster.map((r) => ({ entry: r._id, studentId: r.studentId, name: r.name, status: defaultStatus })),
  });
  await audit({
    classroom: classroom._id,
    user: user._id,
    entity: 'attendance',
    entityId: session._id,
    action: 'create',
    summary: `Took attendance for ${prettyDate(session.date)}${session.label ? ` (${session.label})` : ''}`,
  });
  return session;
};

const findSession = async (classroom: ClassroomDocument, sessionId: string) => {
  if (!Types.ObjectId.isValid(sessionId)) throw ApiError.notFound('Attendance not found');
  const session = await AttendanceSession.findOne({ _id: sessionId, classroom: classroom._id });
  if (!session) throw ApiError.notFound('Attendance not found');
  return session;
};

/** One session, including students who were added to the class after it was taken (unmarked). */
const getSession = async (classroom: ClassroomDocument, sessionId: string) => {
  const session = await findSession(classroom, sessionId);
  const roster = await RosterEntry.find({ classroom: classroom._id }).sort({ studentId: 1 }).lean();
  const byEntry = new Map(session.records.map((r) => [String(r.entry), r]));
  const rosterIds = new Set(roster.map((r) => String(r._id)));

  const records = roster.map((r) => {
    const rec = byEntry.get(String(r._id));
    return {
      entry: r._id,
      studentId: r.studentId,
      name: r.name,
      status: rec?.status ?? '',
      note: rec?.note ?? '',
      checkedInAt: rec?.checkedInAt ?? null,
      removed: false,
    };
  });
  // keep history of students who were later removed from the list
  session.records
    .filter((r) => !rosterIds.has(String(r.entry)))
    .forEach((r) =>
      records.push({
        entry: r.entry,
        studentId: r.studentId,
        name: r.name,
        status: r.status,
        note: r.note ?? '',
        checkedInAt: r.checkedInAt ?? null,
        removed: true,
      }),
    );

  return {
    _id: session._id,
    date: session.date,
    label: session.label,
    topic: session.topic,
    statuses: classroom.settings.attendanceStatuses,
    records,
    updatedAt: session.updatedAt,
  };
};

const updateSession = async (
  classroom: ClassroomDocument,
  user: UserDocument,
  sessionId: string,
  input: UpdateSessionInput,
) => {
  const session = await findSession(classroom, sessionId);
  const changes: IAuditChange[] = [];
  const originalDate = session.date;

  const nextDate = input.date ?? session.date;
  const nextLabel = input.label ?? session.label ?? '';
  if (nextDate !== session.date || nextLabel !== session.label) {
    const clash = await AttendanceSession.exists({
      classroom: classroom._id,
      date: nextDate,
      label: nextLabel,
      _id: { $ne: session._id },
    });
    if (clash) throw ApiError.conflict('Another attendance already uses this date and label');
  }
  if (nextDate !== session.date) changes.push({ label: 'Date', from: session.date, to: nextDate });
  if (nextLabel !== (session.label ?? '')) changes.push({ label: 'Label', from: session.label ?? '', to: nextLabel });
  if (input.topic !== undefined && input.topic !== (session.topic ?? ''))
    changes.push({ label: 'Topic', from: session.topic ?? '', to: input.topic });
  session.date = nextDate;
  session.label = nextLabel;
  if (input.topic !== undefined) session.topic = input.topic;

  if (input.records) {
    const roster = await RosterEntry.find({ classroom: classroom._id }).lean();
    const rosterById = new Map(roster.map((r) => [String(r._id), r]));
    const current = new Map<string, IAttendanceRecord>(session.records.map((r) => [String(r.entry), r]));

    input.records.forEach((rec) => {
      const status = rec.status.toUpperCase();
      assertStatus(classroom, status);
      const student = rosterById.get(rec.entry);
      const existing = current.get(rec.entry);
      if (!student && !existing) return; // unknown student: ignore
      if ((existing?.status ?? '') !== status) {
        changes.push({
          label: `${student?.studentId ?? existing!.studentId} ${student?.name ?? existing!.name}`,
          from: existing?.status || '–',
          to: status || '–',
        });
      }
      current.set(rec.entry, {
        entry: new Types.ObjectId(rec.entry),
        studentId: student?.studentId ?? existing!.studentId,
        name: student?.name ?? existing!.name,
        status,
        note: rec.note ?? existing?.note,
        checkedInAt: existing?.checkedInAt ?? null,
      });
    });
    session.records = [...current.values()].sort((a, b) => a.studentId.localeCompare(b.studentId));
  }

  session.updatedBy = user._id;
  await session.save();
  if (changes.length) {
    await audit({
      classroom: classroom._id,
      user: user._id,
      entity: 'attendance',
      entityId: session._id,
      action: 'update',
      summary: `Edited attendance of ${prettyDate(originalDate)}: ${changes.length} change${changes.length > 1 ? 's' : ''}`,
      changes,
    });
  }
  return getSession(classroom, sessionId);
};

const deleteSession = async (classroom: ClassroomDocument, sessionId: string, user: UserDocument) => {
  const session = await findSession(classroom, sessionId);
  await session.deleteOne();
  await audit({
    classroom: classroom._id,
    user: user._id,
    entity: 'attendance',
    entityId: session._id,
    action: 'delete',
    summary: `Deleted attendance of ${prettyDate(session.date)}${session.label ? ` (${session.label})` : ''}`,
  });
};

/** Student view: own status per session and overall percentage. */
const getMyAttendance = async (classroom: ClassroomDocument, membership: MembershipDocument) => {
  if (!classroom.settings.showAttendanceToStudents) {
    return { hidden: true, statuses: classroom.settings.attendanceStatuses, sessions: [], summary: null };
  }
  if (!membership.rosterEntry) throw ApiError.forbidden('Your account is not linked to a student on this class list');

  const sessions = await AttendanceSession.find({ classroom: classroom._id, 'records.entry': membership.rosterEntry })
    .sort({ date: -1 })
    .lean();
  const present = presentKeys(classroom);
  let total = 0;
  let presentCount = 0;

  const rows = sessions.map((s) => {
    const rec = s.records.find((r) => String(r.entry) === String(membership.rosterEntry));
    const status = rec?.status ?? '';
    if (status) {
      total += 1;
      if (present.has(status)) presentCount += 1;
    }
    return { _id: s._id, date: s.date, label: s.label, topic: s.topic, status, note: rec?.note };
  });

  return {
    hidden: false,
    statuses: classroom.settings.attendanceStatuses,
    threshold: classroom.settings.lowAttendanceThreshold,
    sessions: rows,
    summary: { present: presentCount, total, percent: percent(presentCount, total) },
  };
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Class-level insights: trend per class day, weekday averages, students at risk, absence streaks. */
const getAnalytics = async (classroom: ClassroomDocument) => {
  const register = await getRegister(classroom);
  const present = presentKeys(classroom);
  const threshold = classroom.settings.lowAttendanceThreshold;

  const trend = register.sessions.map((s) => {
    const marked = Object.values(s.marks).filter(Boolean);
    const p = marked.filter((st) => present.has(st)).length;
    return {
      _id: s._id,
      date: s.date,
      label: s.label,
      topic: s.topic,
      present: p,
      marked: marked.length,
      rate: percent(p, marked.length),
    };
  });

  const byWeekday = new Map<number, { present: number; marked: number; classes: number }>();
  trend.forEach((t) => {
    const [y, m, d] = t.date.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const cur = byWeekday.get(wd) ?? { present: 0, marked: 0, classes: 0 };
    cur.present += t.present;
    cur.marked += t.marked;
    cur.classes += 1;
    byWeekday.set(wd, cur);
  });

  const statusTotals: Record<string, number> = {};
  register.sessions.forEach((s) =>
    Object.values(s.marks).forEach((st) => {
      if (st) statusTotals[st] = (statusTotals[st] ?? 0) + 1;
    }),
  );

  // most recent consecutive non-present marks per student
  const newestFirst = [...register.sessions].reverse();
  const students = register.students.map((st) => {
    const sum = register.summary[String(st._id)];
    let streak = 0;
    for (const s of newestFirst) {
      const mark = s.marks[String(st._id)];
      if (!mark) continue;
      if (present.has(mark)) break;
      streak += 1;
    }
    return {
      ...st,
      present: sum?.present ?? 0,
      total: sum?.total ?? 0,
      percent: sum?.percent ?? null,
      absentStreak: streak,
    };
  });

  const rated = trend.filter((t) => t.rate !== null);
  return {
    threshold,
    statuses: classroom.settings.attendanceStatuses,
    overall: {
      classes: trend.length,
      averageRate: rated.length
        ? Math.round((rated.reduce((a, t) => a + (t.rate ?? 0), 0) / rated.length) * 10) / 10
        : null,
      atRisk: students.filter((s) => s.percent !== null && s.percent < threshold).length,
      perfect: students.filter((s) => s.total > 0 && s.present === s.total).length,
    },
    trend,
    byWeekday: [...byWeekday.entries()]
      .sort(([a], [b]) => ((a + 1) % 7) - ((b + 1) % 7)) // Saturday first
      .map(([day, v]) => ({ day, name: WEEKDAYS[day], classes: v.classes, rate: percent(v.present, v.marked) })),
    statusTotals,
    atRisk: students
      .filter((s) => s.percent !== null && s.percent < threshold)
      .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0)),
    streaks: students.filter((s) => s.absentStreak >= 2).sort((a, b) => b.absentStreak - a.absentStreak),
  };
};

export const AttendanceService = {
  getAnalytics,
  getRegister,
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getMyAttendance,
};
