import { Types } from 'mongoose';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { addDays, formatClock, formatInstant, localParts, toMinutes, weekdayOf, zonedToUtc } from '../../lib/time';
import { Classroom, ClassroomDocument, DEFAULT_REMINDERS, ReminderSettings } from '../class/class.model';
import { Membership } from '../class/membership.model';
import { Classwork } from '../classwork/classwork.model';
import { NoticeService } from '../notice/notice.service';
import { NotificationService } from '../notification/notification.service';
import { RoutineSlot } from '../routine/routine.model';
import { UserDocument } from '../user/user.model';
import { ClassDayOff, ReminderLog } from './reminder.model';

type Slot = { _id: Types.ObjectId; classroom: Types.ObjectId; day: number; startTime: string; endTime: string; room?: string; type?: string };
type ClassLite = { _id: Types.ObjectId; title: string; courseCode?: string; room?: string; settings?: { reminders?: Partial<ReminderSettings> } };

export const remindersOf = (c: { settings?: { reminders?: Partial<ReminderSettings> } }): ReminderSettings => ({
  ...DEFAULT_REMINDERS,
  ...(c.settings?.reminders ?? {}),
});

const nameOf = (c: ClassLite) => c.courseCode || c.title;
/** "302" -> "Room 302"; "Room 302" / "Lab 2" stay as typed. */
const place = (room?: string) => (!room ? '' : /^\d/.test(room) ? ` · Room ${room}` : ` · ${room}`);
const sid = (v: unknown) => String(v);
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const prettyDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const inMinutes = (n: number) => (n % 60 === 0 ? `${n / 60} hour${n === 60 ? '' : 's'}` : `${n} minutes`);

/** Marks a reminder as sent. Returns false when it was already sent (unique key). */
const claim = async (key: string) => {
  try {
    await ReminderLog.create({ key });
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }
};

const audience = async (classId: Types.ObjectId, notifyTeachers: boolean) => {
  const members = await Membership.find(notifyTeachers ? { classroom: classId } : { classroom: classId, role: 'student' })
    .select('user')
    .lean();
  return members.map((m) => sid(m.user));
};

const isOff = (offs: { classroom: Types.ObjectId; date: string; slot?: Types.ObjectId | null }[], classId: Types.ObjectId, date: string, slotId?: Types.ObjectId) =>
  offs.some((o) => sid(o.classroom) === sid(classId) && o.date === date && (!o.slot || sid(o.slot) === sid(slotId)));

/** Builds the evening message about tomorrow for one class (null when there is nothing to say). */
const tomorrowDigest = async (c: ClassLite, slots: Slot[], offs: Parameters<typeof isOff>[0], tomorrow: string) => {
  const day = weekdayOf(tomorrow);
  const todaysSlots = slots.filter((s) => sid(s.classroom) === sid(c._id) && s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const from = zonedToUtc(tomorrow, 0);
  const to = zonedToUtc(addDays(tomorrow, 1), 0);
  const work = await Classwork.find({
    classroom: c._id,
    $or: [{ dueAt: { $gte: from, $lt: to } }, { eventAt: { $gte: from, $lt: to } }],
  })
    .select('type title dueAt eventAt')
    .lean();

  const lines: string[] = [];
  for (const s of todaysSlots) {
    if (isOff(offs, c._id, tomorrow, s._id)) lines.push(`No class at ${formatClock(s.startTime)} (cancelled)`);
    else lines.push(`Class ${formatClock(s.startTime)}–${formatClock(s.endTime)}${place(s.room || c.room)}`);
  }
  for (const w of work) {
    if (w.type === 'homework' && w.dueAt) lines.push(`Homework due ${formatInstant(w.dueAt)}: ${w.title}`);
    else if (w.eventAt) lines.push(`${w.type === 'class_test' ? 'Class test' : 'Exam'} at ${formatInstant(w.eventAt)}: ${w.title}`);
  }
  if (!lines.length) return null;
  const hasClass = todaysSlots.some((s) => !isOff(offs, c._id, tomorrow, s._id));
  return {
    title: hasClass ? `Tomorrow · ${nameOf(c)}` : `Tomorrow · ${nameOf(c)} (no class)`,
    body: lines.join('\n'),
  };
};

/**
 * Runs every minute. Sends, in the app time zone:
 *  - "starts in 1 hour" before each class (time set per class),
 *  - an evening message about tomorrow's classes, homework deadlines and tests.
 * Each reminder is sent once (ReminderLog); a late tick still sends it while the window is open.
 */
const tick = async (now: Date = new Date()) => {
  const local = localParts(now);
  const tomorrow = addDays(local.date, 1);
  const classes = (await Classroom.find({ archived: false }).select('title courseCode room settings').lean()) as unknown as ClassLite[];
  const active = classes.filter((c) => remindersOf(c).enabled);
  if (!active.length) return { sent: 0 };
  const ids = active.map((c) => c._id);
  const [slots, offs] = await Promise.all([
    RoutineSlot.find({ classroom: { $in: ids } }).lean() as unknown as Promise<Slot[]>,
    ClassDayOff.find({ classroom: { $in: ids }, date: { $in: [local.date, tomorrow] } }).lean(),
  ]);
  let sent = 0;

  for (const c of active) {
    const r = remindersOf(c);

    // 1) before each class today
    if (r.beforeClass) {
      for (const s of slots.filter((x) => sid(x.classroom) === sid(c._id) && x.day === local.day)) {
        const start = toMinutes(s.startTime);
        if (local.minutes < start - r.minutesBefore || local.minutes >= start) continue;
        if (isOff(offs, c._id, local.date, s._id)) continue;
        if (!(await claim(`soon:${s._id}:${local.date}`))) continue;
        const left = start - local.minutes;
        await NotificationService.notifyUsers(await audience(c._id, r.notifyTeachers), {
          kind: 'class_soon',
          classroom: c._id,
          title: `${nameOf(c)} starts in ${inMinutes(left >= r.minutesBefore - 1 ? r.minutesBefore : left)}`,
          body: `Today ${formatClock(s.startTime)}–${formatClock(s.endTime)}${place(s.room || c.room)}`,
          url: `/classes/${c._id}`,
          tag: `soon-${s._id}`,
        });
        sent++;
      }
    }

    // 2) the evening before
    if (r.nightBefore) {
      const at = toMinutes(r.nightTime);
      if (local.minutes >= at && local.minutes < at + 120) {
        const key = `night:${c._id}:${tomorrow}`;
        const digest = await tomorrowDigest(c, slots, offs, tomorrow);
        if (digest && (await claim(key))) {
          await NotificationService.notifyUsers(await audience(c._id, r.notifyTeachers), {
            kind: 'tomorrow',
            classroom: c._id,
            ...digest,
            url: `/classes/${c._id}`,
            tag: `night-${c._id}`,
          });
          sent++;
        }
      }
    }
  }
  return { sent };
};

/** The next reminders this class will send (shown to the teacher in settings). */
const preview = async (classroom: ClassroomDocument, now: Date = new Date()) => {
  const r = remindersOf(classroom.toObject());
  const local = localParts(now);
  const slots = (await RoutineSlot.find({ classroom: classroom._id }).lean()) as unknown as Slot[];
  const offs = await ClassDayOff.find({ classroom: classroom._id, date: { $gte: local.date } }).lean();
  const items: { at: Date; kind: 'class_soon' | 'tomorrow'; label: string }[] = [];
  if (r.enabled) {
    for (let i = 0; i < 8; i++) {
      const date = addDays(local.date, i);
      const day = weekdayOf(date);
      for (const s of slots.filter((x) => x.day === day)) {
        if (isOff(offs, classroom._id, date, s._id)) continue;
        if (r.beforeClass) {
          items.push({
            at: zonedToUtc(date, toMinutes(s.startTime) - r.minutesBefore),
            kind: 'class_soon',
            label: `"Class starts in ${inMinutes(r.minutesBefore)}" for ${DAY_NAMES[day]} ${formatClock(s.startTime)}`,
          });
        }
      }
      if (r.nightBefore && slots.some((x) => x.day === weekdayOf(addDays(date, 1)))) {
        items.push({ at: zonedToUtc(date, toMinutes(r.nightTime)), kind: 'tomorrow', label: `Summary of ${DAY_NAMES[weekdayOf(addDays(date, 1))]}'s class` });
      }
    }
  }
  return items.filter((i) => i.at > now).sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 6);
};

const overview = async (classroom: ClassroomDocument) => {
  const today = localParts().date;
  const [daysOff, next] = await Promise.all([
    ClassDayOff.find({ classroom: classroom._id, date: { $gte: today } }).populate('slot', 'day startTime endTime').sort({ date: 1 }).lean(),
    preview(classroom),
  ]);
  return { settings: remindersOf(classroom.toObject()), timezone: env.timezone, daysOff, next };
};

const sendTest = async (classroom: ClassroomDocument, user: UserDocument) => {
  const r = remindersOf(classroom.toObject());
  const res = await NotificationService.notifyUsers([user._id], {
    kind: 'reminder_test',
    classroom: classroom._id,
    title: `${classroom.courseCode || classroom.title} starts in ${inMinutes(r.minutesBefore)}`,
    body: 'Test reminder — this is how class reminders look on your phone and in the app.',
    url: `/classes/${classroom._id}/settings`,
    tag: `test-${classroom._id}`,
  });
  return { push: res.push };
};

const addDayOff = async (
  classroom: ClassroomDocument,
  user: UserDocument,
  input: { date: string; slotId?: string; reason?: string; notify?: boolean },
) => {
  if (input.date < localParts().date) throw ApiError.badRequest('Pick today or a future date');
  let slotLabel = '';
  if (input.slotId) {
    const slot = await RoutineSlot.findOne({ _id: input.slotId, classroom: classroom._id }).lean();
    if (!slot) throw ApiError.badRequest('That class time was not found');
    if (slot.day !== weekdayOf(input.date)) throw ApiError.badRequest(`That class time is on ${DAY_NAMES[slot.day]}, not on the chosen date`);
    slotLabel = ` (${formatClock(slot.startTime)})`;
  }
  const exists = await ClassDayOff.findOne({ classroom: classroom._id, date: input.date, slot: input.slotId ?? null });
  if (exists) throw ApiError.conflict('This class is already cancelled');
  const off = await ClassDayOff.create({
    classroom: classroom._id,
    date: input.date,
    slot: input.slotId ?? null,
    reason: input.reason,
    createdBy: user._id,
  });
  if (input.notify !== false) {
    await NoticeService.create(classroom, user, {
      type: 'cancel',
      title: `No class on ${prettyDate(input.date)}${slotLabel}`,
      body: input.reason || undefined,
    });
  }
  return off;
};

const removeDayOff = async (classroom: ClassroomDocument, id: string) => {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Not found');
  const res = await ClassDayOff.deleteOne({ _id: id, classroom: classroom._id });
  if (!res.deletedCount) throw ApiError.notFound('Not found');
};

let timer: NodeJS.Timeout | null = null;
let running = false;
/** Starts the minute-by-minute reminder loop (the API must stay awake — see README). */
const start = () => {
  if (timer || process.env.REMINDERS === 'off') return;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Reminder tick failed:', (err as Error).message);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 15_000);
  timer = setInterval(run, 60_000);
  timer.unref();
};

export const ReminderService = { tick, preview, overview, sendTest, addDayOff, removeDayOff, start };
