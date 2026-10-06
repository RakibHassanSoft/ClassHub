import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { emitToUsers } from '../../lib/socket';
import { prettyDate } from '../../utils/helpers';
import { Classroom, ClassroomDocument } from '../class/class.model';
import { Membership, MembershipDocument } from '../class/membership.model';
import { RosterEntry } from '../roster/roster.model';
import { UserDocument } from '../user/user.model';
import { FileService } from '../file/file.service';
import { PushService } from '../push/push.service';
import { ChatService } from '../chat/chat.service';
import { audit } from '../audit/audit.service';
import { Classwork, ClassworkDocument, ClassworkType, Submission } from './classwork.model';
import { CreateClassworkInput, UpdateClassworkInput } from './classwork.validation';

export const TYPE_LABEL: Record<ClassworkType, string> = {
  class_log: 'Class diary',
  homework: 'Homework',
  class_test: 'Class test',
  exam_syllabus: 'Exam syllabus',
  material: 'Material',
};

const fmtDateTime = (d?: Date | null) =>
  d
    ? d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: process.env.TIMEZONE ?? 'Asia/Dhaka',
      })
    : '';

const studentsOf = async (classId: Types.ObjectId) =>
  (await Membership.find({ classroom: classId, role: 'student' }).select('user').lean()).map((m) => String(m.user));

const findWork = async (classroom: ClassroomDocument, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Post not found');
  const work = await Classwork.findOne({ _id: id, classroom: classroom._id });
  if (!work) throw ApiError.notFound('Post not found');
  return work;
};

const toDate = (v?: string | null) => (v ? new Date(v) : v === null ? null : undefined);

/** Builds the short line used for push + chat cards. */
const describe = (w: ClassworkDocument) => {
  if (w.type === 'homework') return w.dueAt ? `Due ${fmtDateTime(w.dueAt)}` : 'No deadline';
  if (w.type === 'class_test') return `On ${fmtDateTime(w.eventAt)}`;
  if (w.type === 'class_log') return `Class of ${prettyDate(w.date ?? '')}`;
  if (w.type === 'exam_syllabus')
    return `${w.examType === 'mid' ? 'Mid-term' : w.examType === 'final' ? 'Final' : 'Exam'} syllabus`;
  return w.attachments.length ? `${w.attachments.length} file${w.attachments.length > 1 ? 's' : ''}` : 'New material';
};

const list = async (
  classroom: ClassroomDocument,
  user: UserDocument,
  membership: MembershipDocument,
  type?: string,
) => {
  const filter: Record<string, unknown> = { classroom: classroom._id };
  if (type) filter.type = type;
  const items = await Classwork.find(filter)
    .populate('createdBy', 'name')
    .sort({ pinned: -1, createdAt: -1 })
    .limit(300)
    .lean();
  const homeworkIds = items.filter((i) => i.type === 'homework').map((i) => i._id);

  if (membership.role === 'teacher') {
    const subs = await Submission.find({ classwork: { $in: homeworkIds } }).select('classwork late').lean();
    const byId = new Map<string, { n: number; late: number }>();
    subs.forEach((x) => {
      const cur = byId.get(String(x.classwork)) ?? { n: 0, late: 0 };
      cur.n += 1;
      if (x.late) cur.late += 1;
      byId.set(String(x.classwork), cur);
    });
    const students = await RosterEntry.countDocuments({ classroom: classroom._id });
    return items.map((i) =>
      i.type === 'homework'
        ? {
            ...i,
            stats: { submitted: byId.get(String(i._id))?.n ?? 0, late: byId.get(String(i._id))?.late ?? 0, students },
          }
        : i,
    );
  }
  const mine = await Submission.find({ classwork: { $in: homeworkIds }, student: user._id }).lean();
  const myById = new Map(mine.map((s) => [String(s.classwork), s]));
  return items.map((i) => (i.type === 'homework' ? { ...i, mySubmission: myById.get(String(i._id)) ?? null } : i));
};

const create = async (classroom: ClassroomDocument, user: UserDocument, input: CreateClassworkInput) => {
  const attachments = await FileService.toAttachments(user, input.attachmentIds);
  const work = await Classwork.create({
    classroom: classroom._id,
    type: input.type,
    title: input.title,
    description: input.description,
    date: input.type === 'class_log' ? input.date : undefined,
    dueAt: input.type === 'homework' ? (toDate(input.dueAt) ?? null) : null,
    eventAt: input.type === 'class_test' || input.type === 'exam_syllabus' ? (toDate(input.eventAt) ?? null) : null,
    examType: input.type === 'exam_syllabus' ? (input.examType ?? 'other') : undefined,
    allowSubmission: input.type === 'homework' ? (input.allowSubmission ?? true) : false,
    allowLate: input.allowLate ?? true,
    maxScore: input.type === 'homework' ? (input.maxScore ?? null) : null,
    links: input.links ?? [],
    attachments,
    pinned: input.pinned ?? false,
    createdBy: user._id,
  });

  const className = classroom.courseCode || classroom.title;
  const students = await studentsOf(classroom._id);
  emitToUsers(students, 'classwork:new', {
    classId: String(classroom._id),
    id: String(work._id),
    type: work.type,
    title: work.title,
    className,
  });
  if (work.type !== 'class_log' || work.attachments.length) {
    PushService.sendToUsers(students, {
      title: `${TYPE_LABEL[work.type]} · ${className}`,
      body: `${work.title} — ${describe(work)}`,
      url: `/classes/${classroom._id}/classwork?item=${work._id}`,
      tag: `cw-${work._id}`,
      urgent: work.type === 'class_test',
    }).catch(() => undefined);
  }
  if (input.notifyChat !== false) {
    await ChatService.postClassCard(classroom, user, {
      text: `${TYPE_LABEL[work.type]}: ${work.title}`,
      ref: {
        type: work.type,
        id: work._id,
        title: work.title,
        dueAt: work.dueAt,
        eventAt: work.eventAt,
        files: work.attachments.length,
      },
    });
  }
  await audit({
    classroom: classroom._id,
    user: user._id,
    entity: 'class',
    entityId: work._id,
    action: 'create',
    summary: `Posted ${TYPE_LABEL[work.type].toLowerCase()} "${work.title}"`,
  });
  return work;
};

const update = async (classroom: ClassroomDocument, user: UserDocument, id: string, input: UpdateClassworkInput) => {
  const work = await findWork(classroom, id);
  const oldDue = work.dueAt?.getTime() ?? null;
  const oldEvent = work.eventAt?.getTime() ?? null;
  const { attachmentIds, dueAt, eventAt, ...rest } = input;
  work.set(rest);
  if (dueAt !== undefined) work.dueAt = toDate(dueAt) ?? null;
  if (eventAt !== undefined) work.eventAt = toDate(eventAt) ?? null;
  if (attachmentIds) {
    // keep existing attachments that are still listed, add newly uploaded ones
    const keep = work.attachments.filter((a) => attachmentIds.includes(String(a.file)));
    const keepIds = new Set(keep.map((a) => String(a.file)));
    const added = await FileService.toAttachments(
      user,
      attachmentIds.filter((x) => !keepIds.has(x)),
    );
    work.attachments = [...keep, ...added];
  }
  await work.save();

  const timeChanged = (work.dueAt?.getTime() ?? null) !== oldDue || (work.eventAt?.getTime() ?? null) !== oldEvent;
  if (timeChanged) {
    const students = await studentsOf(classroom._id);
    const className = classroom.courseCode || classroom.title;
    const what =
      work.type === 'homework'
        ? `New deadline: ${work.dueAt ? fmtDateTime(work.dueAt) : 'none'}`
        : `New date: ${fmtDateTime(work.eventAt)}`;
    emitToUsers(students, 'classwork:updated', {
      classId: String(classroom._id),
      id: String(work._id),
      title: work.title,
      className,
      what,
    });
    PushService.sendToUsers(students, {
      title: `Updated · ${className}`,
      body: `${work.title} — ${what}`,
      url: `/classes/${classroom._id}/classwork?item=${work._id}`,
      tag: `cw-${work._id}`,
    }).catch(() => undefined);
    await audit({
      classroom: classroom._id,
      user: user._id,
      entity: 'class',
      entityId: work._id,
      action: 'update',
      summary: `Changed ${work.type === 'homework' ? 'deadline' : 'date'} of "${work.title}"`,
      changes: [
        {
          label: work.type === 'homework' ? 'Deadline' : 'Date',
          from: oldDue || oldEvent ? fmtDateTime(new Date((oldDue ?? oldEvent)!)) : '–',
          to: fmtDateTime(work.dueAt ?? work.eventAt) || '–',
        },
      ],
    });
  }
  return work;
};

const remove = async (classroom: ClassroomDocument, user: UserDocument, id: string) => {
  const work = await findWork(classroom, id);
  await Submission.deleteMany({ classwork: work._id });
  await work.deleteOne();
  await audit({
    classroom: classroom._id,
    user: user._id,
    entity: 'class',
    entityId: work._id,
    action: 'delete',
    summary: `Deleted ${TYPE_LABEL[work.type].toLowerCase()} "${work.title}"`,
  });
};

const getOne = async (classroom: ClassroomDocument, user: UserDocument, membership: MembershipDocument, id: string) => {
  const work = await findWork(classroom, id);
  await work.populate('createdBy', 'name');
  const mySubmission =
    membership.role === 'student'
      ? await Submission.findOne({ classwork: work._id, student: user._id }).lean()
      : undefined;
  return { ...work.toObject(), mySubmission: mySubmission ?? null };
};

const submit = async (
  classroom: ClassroomDocument,
  user: UserDocument,
  membership: MembershipDocument,
  id: string,
  input: { text?: string; attachmentIds?: string[] },
) => {
  if (membership.role !== 'student' || !membership.rosterEntry)
    throw ApiError.forbidden('Only students of this class can submit');
  const work = await findWork(classroom, id);
  if (work.type !== 'homework' || !work.allowSubmission)
    throw ApiError.badRequest('This post does not take submissions');
  const now = new Date();
  const late = Boolean(work.dueAt && now > work.dueAt);
  if (late && !work.allowLate) throw ApiError.forbidden('The deadline has passed and late submissions are closed');
  const existing = await Submission.findOne({ classwork: work._id, student: user._id });
  if (existing?.gradedAt) throw ApiError.badRequest('Your teacher has already marked this. Ask them to reopen it.');

  const entry = await RosterEntry.findById(membership.rosterEntry).lean();
  const attachments = await FileService.toAttachments(user, input.attachmentIds);
  const sub = await Submission.findOneAndUpdate(
    { classwork: work._id, student: user._id },
    {
      classwork: work._id,
      classroom: classroom._id,
      student: user._id,
      studentId: entry?.studentId ?? user.studentId ?? '',
      name: entry?.name ?? user.name,
      text: input.text,
      attachments,
      submittedAt: now,
      late,
    },
    { upsert: true, new: true },
  );
  const teachers = (await Membership.find({ classroom: classroom._id, role: 'teacher' }).select('user').lean()).map(
    (m) => String(m.user),
  );
  emitToUsers(teachers, 'submission:new', {
    classId: String(classroom._id),
    id: String(work._id),
    title: work.title,
    name: sub.name,
    late,
  });
  return sub;
};

const unsubmit = async (classroom: ClassroomDocument, user: UserDocument, id: string) => {
  const work = await findWork(classroom, id);
  const sub = await Submission.findOne({ classwork: work._id, student: user._id });
  if (!sub) return;
  if (sub.gradedAt) throw ApiError.badRequest('Already marked by your teacher');
  if (work.dueAt && new Date() > work.dueAt) throw ApiError.badRequest('You cannot unsubmit after the deadline');
  await sub.deleteOne();
};

/** Teacher: every student on the class list with their submission status. */
const submissions = async (classroom: ClassroomDocument, id: string) => {
  const work = await findWork(classroom, id);
  const [roster, subs] = await Promise.all([
    RosterEntry.find({ classroom: classroom._id }).sort({ studentId: 1 }).lean(),
    Submission.find({ classwork: work._id }).lean(),
  ]);
  const byStudent = new Map(subs.map((s) => [String(s.student), s]));
  const rows = roster.map((r) => {
    const sub = r.claimedBy ? byStudent.get(String(r.claimedBy)) : undefined;
    const status = !r.claimedBy
      ? 'not_joined'
      : sub
        ? sub.late
          ? 'late'
          : 'submitted'
        : work.dueAt && new Date() > work.dueAt
          ? 'missing'
          : 'pending';
    return { entry: r._id, studentId: r.studentId, name: r.name, status, submission: sub ?? null };
  });
  return {
    work: { _id: work._id, title: work.title, dueAt: work.dueAt, maxScore: work.maxScore, allowLate: work.allowLate },
    rows,
  };
};

const grade = async (
  classroom: ClassroomDocument,
  id: string,
  submissionId: string,
  input: { score?: number | null; feedback?: string },
) => {
  const work = await findWork(classroom, id);
  if (!Types.ObjectId.isValid(submissionId)) throw ApiError.notFound('Submission not found');
  const sub = await Submission.findOne({ _id: submissionId, classwork: work._id });
  if (!sub) throw ApiError.notFound('Submission not found');
  if (input.score != null && work.maxScore != null && input.score > work.maxScore)
    throw ApiError.badRequest(`Score cannot be more than ${work.maxScore}`);
  if (input.score !== undefined) sub.score = input.score;
  if (input.feedback !== undefined) sub.feedback = input.feedback;
  sub.gradedAt = new Date();
  await sub.save();
  const className = classroom.courseCode || classroom.title;
  emitToUsers([String(sub.student)], 'submission:graded', {
    classId: String(classroom._id),
    id: String(work._id),
    title: work.title,
    className,
  });
  PushService.sendToUsers([sub.student], {
    title: `Homework checked · ${className}`,
    body: `${work.title}${sub.score != null ? ` — ${sub.score}${work.maxScore != null ? `/${work.maxScore}` : ''}` : ''}`,
    url: `/classes/${classroom._id}/classwork?item=${work._id}`,
  }).catch(() => undefined);
  return sub;
};

/** Dashboard: homework deadlines and class tests coming up across all classes of the user. */
const upcoming = async (user: UserDocument) => {
  const memberships = await Membership.find({ user: user._id }).lean();
  const classes = await Classroom.find({ _id: { $in: memberships.map((m) => m.classroom) }, archived: false })
    .select('title courseCode color')
    .lean();
  const classById = new Map(classes.map((c) => [String(c._id), c]));
  const since = new Date(Date.now() - 6 * 3600_000);
  const items = await Classwork.find({
    classroom: { $in: classes.map((c) => c._id) },
    $or: [
      { type: 'homework', dueAt: { $gte: since } },
      { type: 'class_test', eventAt: { $gte: since } },
      { type: 'exam_syllabus', eventAt: { $gte: since } },
    ],
  })
    .sort({ dueAt: 1, eventAt: 1 })
    .limit(50)
    .lean();
  const mine = await Submission.find({ student: user._id, classwork: { $in: items.map((i) => i._id) } })
    .select('classwork')
    .lean();
  const done = new Set(mine.map((m) => String(m.classwork)));
  return items
    .map((i) => ({
      _id: i._id,
      type: i.type,
      title: i.title,
      at: i.dueAt ?? i.eventAt,
      classroom: classById.get(String(i.classroom)),
      submitted: i.type === 'homework' ? done.has(String(i._id)) : undefined,
    }))
    .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());
};

export const ClassworkService = {
  list,
  create,
  update,
  remove,
  getOne,
  submit,
  unsubmit,
  submissions,
  grade,
  upcoming,
};
