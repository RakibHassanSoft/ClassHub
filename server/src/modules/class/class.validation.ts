import { z } from 'zod';
import { CLASS_COLORS } from './class.model';

const optionalText = (max: number) => z.string().trim().max(max).optional();

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm');

/** Weekly class times entered when the class is created (become routine slots). */
const scheduleSchema = z
  .array(
    z
      .object({ day: z.number().int().min(0).max(6), startTime: hhmm, endTime: hhmm, room: optionalText(60) })
      .refine((s) => s.endTime > s.startTime, { message: 'End time must be after start time', path: ['endTime'] }),
  )
  .max(14)
  .optional();

const classFields = z.object({
  title: z.string().trim().min(2, 'Class name must be at least 2 characters').max(120),
  courseCode: optionalText(30),
  section: optionalText(30),
  semester: optionalText(40),
  description: optionalText(1000),
  room: optionalText(60),
  color: z.enum(CLASS_COLORS).optional(),
});

export const createClassSchema = classFields.extend({ schedule: scheduleSchema });

const statusOption = z.object({
  key: z.string().trim().min(1).max(3),
  label: z.string().trim().min(1).max(24),
  countsAsPresent: z.boolean(),
  color: z.string().trim().max(20),
});

export const updateClassSchema = classFields.partial().extend({
  archived: z.boolean().optional(),
  joinEnabled: z.boolean().optional(),
  settings: z
    .object({
      attendanceStatuses: z
        .array(statusOption)
        .min(2, 'Keep at least two attendance statuses')
        .max(8)
        .refine((arr) => new Set(arr.map((s) => s.key.toUpperCase())).size === arr.length, {
          message: 'Status codes must be unique',
        })
        .optional(),
      showAttendanceToStudents: z.boolean().optional(),
      lowAttendanceThreshold: z.number().min(0).max(100).optional(),
      chatEnabled: z.boolean().optional(),
      chatTeacherOnly: z.boolean().optional(),
      allowStudentDirect: z.boolean().optional(),
      reminders: z
        .object({
          enabled: z.boolean().optional(),
          nightBefore: z.boolean().optional(),
          nightTime: hhmm.optional(),
          beforeClass: z.boolean().optional(),
          minutesBefore: z.number().int().min(5).max(720).optional(),
          notifyTeachers: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;

export const cloneClassSchema = createClassSchema.extend({
  include: z
    .object({
      settings: z.boolean().default(true), // attendance statuses, chat rules, minimum %
      routine: z.boolean().default(true),
      resources: z.boolean().default(true),
      assessments: z.boolean().default(true), // structure only, no marks
      roster: z.boolean().default(false),
    })
    .default({ settings: true, routine: true, resources: true, assessments: true, roster: false }),
});
export type CloneClassInput = z.infer<typeof cloneClassSchema>;
