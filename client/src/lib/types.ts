export type Role = 'teacher' | 'student';
export type UserRole = Role | 'admin';
export type TeacherStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: UserRole;
  studentId?: string;
  /** teachers: employee ID checked by the admin */
  employeeId?: string;
  teacherStatus?: TeacherStatus;
  reviewNote?: string;
  isActive?: boolean;
  institution?: string;
  department?: string;
  phone?: string;
  createdAt: string;
}

export interface AttendanceStatus {
  key: string;
  label: string;
  countsAsPresent: boolean;
  color: string;
}

export interface Classroom {
  _id: string;
  title: string;
  courseCode?: string;
  section?: string;
  semester?: string;
  description?: string;
  room?: string;
  color: string;
  owner: { _id: string; name: string; email?: string; institution?: string; department?: string };
  joinCode?: string;
  joinEnabled: boolean;
  archived: boolean;
  settings: {
    attendanceStatuses: AttendanceStatus[];
    showAttendanceToStudents: boolean;
    lowAttendanceThreshold: number;
    chatEnabled: boolean;
    chatTeacherOnly: boolean;
    allowStudentDirect: boolean;
    reminders?: ReminderSettings;
  };
  myRole: Role;
  isOwner?: boolean;
  isCR?: boolean;
  stats: { students: number; joined: number };
  createdAt: string;
  updatedAt: string;
}

export interface RosterEntry {
  _id: string;
  studentId: string;
  name: string;
  email?: string;
  phone?: string;
  section?: string;
  claimedBy?: { _id: string; name: string; email: string } | null;
  claimedAt?: string | null;
  source: 'manual' | 'csv' | 'ai' | 'self';
}

export interface RosterRow {
  studentId: string;
  name: string;
  email?: string;
  phone?: string;
  section?: string;
}

export interface ExtractedStudent extends RosterRow {
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
}

export interface AttendanceRegister {
  statuses: AttendanceStatus[];
  threshold: number;
  students: { _id: string; studentId: string; name: string; joined: boolean }[];
  sessions: {
    _id: string;
    date: string;
    label?: string;
    topic?: string;
    counts: Record<string, number>;
    marks: Record<string, string>;
    updatedAt: string;
  }[];
  summary: Record<string, { present: number; total: number; percent: number | null }>;
}

export interface AttendanceSessionDetail {
  _id: string;
  date: string;
  label?: string;
  topic?: string;
  statuses: AttendanceStatus[];
  records: {
    entry: string;
    studentId: string;
    name: string;
    status: string;
    note?: string;
    checkedInAt?: string | null;
    removed: boolean;
  }[];
  updatedAt: string;
}

export interface MyAttendance {
  hidden: boolean;
  statuses: AttendanceStatus[];
  threshold?: number;
  sessions: { _id: string; date: string; label?: string; topic?: string; status: string; note?: string }[];
  summary: { present: number; total: number; percent: number | null } | null;
}

export type SlotType = 'theory' | 'lab' | 'tutorial' | 'other';

export interface RoutineSlot {
  _id: string;
  classroom: string | { _id: string; title: string; courseCode?: string; section?: string; color: string };
  day: number;
  startTime: string;
  endTime: string;
  room?: string;
  type: SlotType;
  note?: string;
}

export type DriveType = 'folder' | 'document' | 'spreadsheet' | 'presentation' | 'form' | 'file';

export interface Resource {
  _id: string;
  title: string;
  kind: 'drive' | 'link' | 'note' | 'file';
  attachments?: Attachment[];
  url?: string;
  driveType?: DriveType | null;
  topic?: string;
  description?: string;
  pinned: boolean;
  createdBy?: { _id: string; name: string };
  createdAt: string;
}

export type AssessmentCategory = 'quiz' | 'assignment' | 'mid' | 'final' | 'lab' | 'presentation' | 'project' | 'other';

export interface Totals {
  obtained: number;
  max: number;
  percent: number | null;
  weighted: number | null;
  weightTotal: number;
}

export interface MarksSheet {
  students: { _id: string; studentId: string; name: string }[];
  assessments: {
    _id: string;
    name: string;
    category: AssessmentCategory;
    maxMarks: number;
    weight?: number | null;
    date?: string;
    published: boolean;
    scores: Record<string, { score: number | null; remarks?: string }>;
    stats: { graded: number; average: number | null };
  }[];
  totals: Record<string, Totals>;
}

export interface MyMarks {
  assessments: {
    _id: string;
    name: string;
    category: AssessmentCategory;
    maxMarks: number;
    weight?: number | null;
    date?: string;
    score: number | null;
    remarks?: string;
  }[];
  totals: Totals;
}

export type NoticeType = 'general' | 'note' | 'cancel' | 'reschedule' | 'urgent' | 'reminder';

export interface Notice {
  _id: string;
  classroom: string | { _id: string; title: string; courseCode?: string; color: string };
  type: NoticeType;
  title: string;
  body?: string;
  link?: string;
  pinned: boolean;
  summary?: string | null;
  /** 'reminder' = personal class reminder merged into the feed */
  kind?: 'reminder';
  reminderKind?: 'class_soon' | 'tomorrow' | 'reminder_test';
  author?: { _id: string; name: string };
  seen: boolean;
  seenCount?: number;
  createdAt: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ConversationSummary {
  _id: string;
  type: 'class' | 'direct';
  classroom: { _id: string; title: string; courseCode?: string; section?: string; color: string } | null;
  title: string;
  other?: { _id: string; name: string; role: Role; studentId?: string };
  myRole: Role;
  teacherOnly: boolean;
  lastMessage?: { text: string; sender: string; senderName: string; at: string } | null;
  unread: number;
  updatedAt: string;
}

export interface ConversationDetail {
  _id: string;
  type: 'class' | 'direct';
  participants: { _id: string; name: string; role: Role; studentId?: string }[];
  classroom: { _id: string; title: string; courseCode?: string; color: string };
  myRole: Role;
  canPost: boolean;
  /** teachers and class representatives can create polls */
  canPoll?: boolean;
}

export type MessageKind = 'text' | 'image' | 'file' | 'poll' | 'classwork';

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface ChatPoll {
  question: string;
  options: PollOption[];
  multiple: boolean;
  closed: boolean;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: { _id: string; name: string; role: Role };
  kind?: MessageKind;
  ref?: { type: ClassworkType; id: string; title: string; dueAt?: string | null; eventAt?: string | null; files?: number } | null;
  text: string;
  attachments?: Attachment[];
  replyTo?: { id: string; senderName: string; text: string; kind: MessageKind } | null;
  poll?: ChatPoll | null;
  /** short AI version of a long teacher message */
  summary?: string | null;
  deleted: boolean;
  createdAt: string;
  /** client only: still sending */
  pending?: boolean;
}

export interface ReadState {
  user: string;
  at: string;
}

export interface AuditEntry {
  _id: string;
  entity: 'attendance' | 'marks' | 'roster' | 'class' | 'notice' | 'member';
  action: 'create' | 'update' | 'delete';
  summary: string;
  changes: { label: string; from?: string; to?: string }[];
  user?: { _id: string; name: string };
  createdAt: string;
}

export interface AttendanceAnalytics {
  threshold: number;
  statuses: AttendanceStatus[];
  overall: { classes: number; averageRate: number | null; atRisk: number; perfect: number };
  trend: { _id: string; date: string; label?: string; topic?: string; present: number; marked: number; rate: number | null }[];
  byWeekday: { day: number; name: string; classes: number; rate: number | null }[];
  statusTotals: Record<string, number>;
  atRisk: StudentRate[];
  streaks: StudentRate[];
}

export interface StudentRate {
  _id: string;
  studentId: string;
  name: string;
  joined: boolean;
  present: number;
  total: number;
  percent: number | null;
  absentStreak: number;
}

export interface ClassPeople {
  teachers: { _id: string; name: string; email: string; isOwner: boolean }[];
  representatives: { _id: string; name: string; studentId?: string; isCR: boolean }[];
  students?: { _id: string; name: string; studentId?: string; isCR: boolean }[];
}

export interface SemesterReportClass {
  _id: string;
  title: string;
  courseCode?: string;
  section?: string;
  semester?: string;
  threshold: number;
  statuses: AttendanceStatus[];
  sessions: { date: string; label?: string; topic?: string; marks: Record<string, string> }[];
  assessments: { _id: string; name: string; maxMarks: number; weight?: number | null; published: boolean }[];
  students: {
    _id: string;
    studentId: string;
    name: string;
    attendance?: { present: number; total: number; percent: number | null };
    scores: Record<string, number | null>;
    totals?: Totals;
  }[];
}

export interface CheckinStatus {
  sessionId: string;
  date: string;
  label?: string;
  open: boolean;
  endsAt: string | null;
  code?: string;
  stepSeconds: number;
  codeExpiresIn: number;
  checkedIn?: { entry: string; studentId: string; name: string; at: string }[];
  total: number;
}

export interface ActiveCheckin {
  sessionId: string;
  date: string;
  label?: string;
  endsAt: string;
  checkedIn: boolean;
}

export type FileKind = 'image' | 'pdf' | 'doc' | 'sheet' | 'slides' | 'archive' | 'text' | 'other';

export interface Attachment {
  file: string;
  url: string;
  name: string;
  size: number;
  mime: string;
  kind: FileKind;
}

export interface UploadedFile extends Omit<Attachment, 'file'> {
  _id: string;
}

export type ClassworkType = 'class_log' | 'homework' | 'class_test' | 'exam_syllabus' | 'material';

export interface Submission {
  _id: string;
  classwork: string;
  student: string;
  studentId: string;
  name: string;
  text?: string;
  attachments: Attachment[];
  submittedAt: string;
  late: boolean;
  score?: number | null;
  feedback?: string;
  gradedAt?: string | null;
}

export interface ClassworkItem {
  _id: string;
  classroom: string;
  type: ClassworkType;
  title: string;
  description?: string;
  date?: string;
  dueAt?: string | null;
  eventAt?: string | null;
  examType?: 'mid' | 'final' | 'other';
  allowSubmission: boolean;
  allowLate: boolean;
  maxScore?: number | null;
  links: { url: string; title?: string }[];
  attachments: Attachment[];
  pinned: boolean;
  createdBy?: { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
  stats?: { submitted: number; late: number; students: number };
  mySubmission?: Submission | null;
}

export interface SubmissionRow {
  entry: string;
  studentId: string;
  name: string;
  status: 'submitted' | 'late' | 'missing' | 'pending' | 'not_joined';
  submission: Submission | null;
}

export interface UpcomingItem {
  _id: string;
  type: ClassworkType;
  title: string;
  at: string;
  classroom?: { _id: string; title: string; courseCode?: string; color: string };
  submitted?: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  nightBefore: boolean;
  nightTime: string;
  beforeClass: boolean;
  minutesBefore: number;
  notifyTeachers: boolean;
}

export interface DayOff {
  _id: string;
  date: string;
  slot?: { _id: string; day: number; startTime: string; endTime: string } | null;
  reason?: string;
}

export interface ReminderOverview {
  settings: ReminderSettings;
  timezone: string;
  daysOff: DayOff[];
  next: { at: string; kind: 'class_soon' | 'tomorrow'; label: string }[];
}
