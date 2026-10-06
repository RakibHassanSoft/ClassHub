import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { ClassroomDocument } from '../class/class.model';
import { MembershipDocument } from '../class/membership.model';
import { UserDocument } from '../user/user.model';
import { RosterEntry } from '../roster/roster.model';
import { Assessment, IScore } from './marks.model';
import { CreateAssessmentInput, SaveScoresInput, UpdateAssessmentInput } from './marks.validation';
import { audit } from '../audit/audit.service';
import { IAuditChange } from '../audit/audit.model';

const round = (n: number) => Math.round(n * 100) / 100;

interface Totals {
  obtained: number;
  max: number;
  percent: number | null;
  weighted: number | null; // out of the sum of weights
  weightTotal: number;
}

const computeTotals = (
  items: { maxMarks: number; weight?: number | null; score: number | null | undefined }[],
): Totals => {
  let obtained = 0;
  let max = 0;
  let weighted = 0;
  let weightTotal = 0;
  let hasWeight = false;
  items.forEach((a) => {
    if (a.score === null || a.score === undefined) return;
    obtained += a.score;
    max += a.maxMarks;
    if (a.weight) {
      hasWeight = true;
      weighted += (a.score / a.maxMarks) * a.weight;
      weightTotal += a.weight;
    }
  });
  return {
    obtained: round(obtained),
    max: round(max),
    percent: max ? round((obtained / max) * 100) : null,
    weighted: hasWeight ? round(weighted) : null,
    weightTotal,
  };
};

const sortAssessments = { date: 1, createdAt: 1 } as const;

/** Teacher grade sheet: students x assessments. */
const getSheet = async (classroom: ClassroomDocument) => {
  const [roster, assessments] = await Promise.all([
    RosterEntry.find({ classroom: classroom._id }).sort({ studentId: 1 }).lean(),
    Assessment.find({ classroom: classroom._id }).sort(sortAssessments).lean(),
  ]);

  const list = assessments.map((a) => {
    const scores: Record<string, { score: number | null; remarks?: string }> = {};
    a.scores.forEach((s) => {
      scores[String(s.entry)] = { score: s.score, remarks: s.remarks };
    });
    const graded = a.scores.filter((s) => s.score !== null && s.score !== undefined);
    const avg = graded.length ? round(graded.reduce((t, s) => t + (s.score ?? 0), 0) / graded.length) : null;
    return {
      _id: a._id,
      name: a.name,
      category: a.category,
      maxMarks: a.maxMarks,
      weight: a.weight,
      date: a.date,
      published: a.published,
      scores,
      stats: { graded: graded.length, average: avg },
    };
  });

  const totals: Record<string, Totals> = {};
  roster.forEach((r) => {
    const id = String(r._id);
    totals[id] = computeTotals(
      list.map((a) => ({ maxMarks: a.maxMarks, weight: a.weight, score: a.scores[id]?.score })),
    );
  });

  return {
    students: roster.map((r) => ({ _id: r._id, studentId: r.studentId, name: r.name })),
    assessments: list,
    totals,
  };
};

const create = async (classroom: ClassroomDocument, user: UserDocument, input: CreateAssessmentInput) => {
  const doc = await Assessment.create({
    ...input,
    date: input.date || undefined,
    classroom: classroom._id,
    createdBy: user._id,
  });
  await audit({
    classroom: classroom._id,
    user: user._id,
    entity: 'marks',
    entityId: doc._id,
    action: 'create',
    summary: `Added assessment "${doc.name}" (/${doc.maxMarks})`,
  });
  return doc;
};

const findOne = async (classroom: ClassroomDocument, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Assessment not found');
  const doc = await Assessment.findOne({ _id: id, classroom: classroom._id });
  if (!doc) throw ApiError.notFound('Assessment not found');
  return doc;
};

const update = async (classroom: ClassroomDocument, id: string, input: UpdateAssessmentInput, user?: UserDocument) => {
  const doc = await findOne(classroom, id);
  const changes: IAuditChange[] = [];
  (['name', 'maxMarks', 'weight', 'published'] as const).forEach((k) => {
    if (input[k] !== undefined && String(input[k] ?? '') !== String(doc[k] ?? '')) {
      changes.push({
        label: k === 'maxMarks' ? 'Total marks' : k[0].toUpperCase() + k.slice(1),
        from: String(doc[k] ?? ''),
        to: String(input[k] ?? ''),
      });
    }
  });
  if (input.maxMarks !== undefined) {
    const over = doc.scores.find((s) => s.score !== null && s.score > input.maxMarks!);
    if (over)
      throw ApiError.badRequest(`${over.studentId} already has ${over.score}; total marks cannot be lower than that`);
  }
  doc.set({ ...input, date: input.date === '' ? undefined : (input.date ?? doc.date) });
  await doc.save();
  if (user && changes.length) {
    const published = changes.find((c) => c.label === 'Published');
    await audit({
      classroom: classroom._id,
      user: user._id,
      entity: 'marks',
      entityId: doc._id,
      action: 'update',
      summary:
        published && changes.length === 1
          ? `${published.to === 'true' ? 'Published' : 'Hid'} "${doc.name}"`
          : `Edited assessment "${doc.name}"`,
      changes,
    });
  }
  return doc;
};

const remove = async (classroom: ClassroomDocument, id: string, user?: UserDocument) => {
  const doc = await findOne(classroom, id);
  await doc.deleteOne();
  if (user) {
    await audit({
      classroom: classroom._id,
      user: user._id,
      entity: 'marks',
      entityId: doc._id,
      action: 'delete',
      summary: `Deleted assessment "${doc.name}" and its marks`,
    });
  }
};

const saveScores = async (classroom: ClassroomDocument, id: string, input: SaveScoresInput, user?: UserDocument) => {
  const doc = await findOne(classroom, id);
  const changes: IAuditChange[] = [];
  const roster = await RosterEntry.find({ classroom: classroom._id }).lean();
  const rosterById = new Map(roster.map((r) => [String(r._id), r]));
  const current = new Map<string, IScore>(doc.scores.map((s) => [String(s.entry), s]));

  input.scores.forEach((s) => {
    const student = rosterById.get(s.entry);
    if (!student) return;
    if (s.score !== null && s.score > doc.maxMarks) {
      throw ApiError.badRequest(`${student.studentId}: ${s.score} is more than the total (${doc.maxMarks})`);
    }
    const before = current.get(s.entry)?.score ?? null;
    if (before !== s.score) {
      changes.push({
        label: `${student.studentId} ${student.name}`,
        from: before === null ? '–' : String(before),
        to: s.score === null ? '–' : String(s.score),
      });
    }
    current.set(s.entry, {
      entry: new Types.ObjectId(s.entry),
      studentId: student.studentId,
      score: s.score,
      remarks: s.remarks ?? current.get(s.entry)?.remarks,
    });
  });

  doc.scores = [...current.values()];
  await doc.save();
  if (user && changes.length) {
    await audit({
      classroom: classroom._id,
      user: user._id,
      entity: 'marks',
      entityId: doc._id,
      action: 'update',
      summary: `Updated marks of "${doc.name}": ${changes.length} change${changes.length > 1 ? 's' : ''}`,
      changes,
    });
  }
  return doc;
};

/** Student view: only published assessments and only their own marks. */
const getMine = async (classroom: ClassroomDocument, membership: MembershipDocument) => {
  if (!membership.rosterEntry) throw ApiError.forbidden('Your account is not linked to a student on this class list');
  const entryId = String(membership.rosterEntry);
  const assessments = await Assessment.find({ classroom: classroom._id, published: true }).sort(sortAssessments).lean();
  const rows = assessments.map((a) => {
    const mine = a.scores.find((s) => String(s.entry) === entryId);
    return {
      _id: a._id,
      name: a.name,
      category: a.category,
      maxMarks: a.maxMarks,
      weight: a.weight,
      date: a.date,
      score: mine?.score ?? null,
      remarks: mine?.remarks,
    };
  });
  return { assessments: rows, totals: computeTotals(rows) };
};

export const MarksService = { getSheet, create, update, remove, saveScores, getMine };
