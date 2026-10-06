import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { auth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { ApiError } from '../../utils/ApiError';
import { catchAsync } from '../../utils/catchAsync';
import { sendResponse } from '../../utils/sendResponse';
import { Classroom } from '../class/class.model';
import { Membership } from '../class/membership.model';
import { AttendanceService } from '../attendance/attendance.service';
import { MarksService } from '../marks/marks.service';

const querySchema = z.object({
  classIds: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .refine(
      (ids) => ids.length > 0 && ids.length <= 30 && ids.every((id) => Types.ObjectId.isValid(id)),
      'Choose 1–30 classes',
    ),
});

/** Everything needed for a semester workbook: one combined row per student per class. */
const semesterReport = async (userId: Types.ObjectId, classIds: string[]) => {
  const memberships = await Membership.find({ user: userId, role: 'teacher', classroom: { $in: classIds } }).lean();
  if (!memberships.length) throw ApiError.forbidden('You are not a teacher of the selected classes');
  const classes = await Classroom.find({ _id: { $in: memberships.map((m) => m.classroom) } }).sort({
    courseCode: 1,
    title: 1,
  });

  return Promise.all(
    classes.map(async (classroom) => {
      const [register, sheet] = await Promise.all([
        AttendanceService.getRegister(classroom),
        MarksService.getSheet(classroom),
      ]);
      return {
        _id: classroom._id,
        title: classroom.title,
        courseCode: classroom.courseCode,
        section: classroom.section,
        semester: classroom.semester,
        threshold: classroom.settings.lowAttendanceThreshold,
        statuses: classroom.settings.attendanceStatuses,
        sessions: register.sessions.map((s) => ({ date: s.date, label: s.label, topic: s.topic, marks: s.marks })),
        assessments: sheet.assessments.map((a) => ({
          _id: a._id,
          name: a.name,
          maxMarks: a.maxMarks,
          weight: a.weight,
          published: a.published,
        })),
        students: register.students.map((st) => {
          const id = String(st._id);
          return {
            _id: st._id,
            studentId: st.studentId,
            name: st.name,
            attendance: register.summary[id],
            scores: Object.fromEntries(sheet.assessments.map((a) => [String(a._id), a.scores[id]?.score ?? null])),
            totals: sheet.totals[id],
          };
        }),
      };
    }),
  );
};

const router = Router();

router.get(
  '/semester',
  auth('teacher'),
  validate(querySchema, 'query'),
  catchAsync(async (req, res) => {
    const { classIds } = req.query as unknown as { classIds: string[] };
    sendResponse(res, { message: 'Semester report', data: await semesterReport(req.user!._id, classIds) });
  }),
);

export const ReportRoutes = router;
