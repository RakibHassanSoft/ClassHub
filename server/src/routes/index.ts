import { Router } from 'express';
import { AuthRoutes } from '../modules/auth/auth.routes';
import { UserRoutes } from '../modules/user/user.routes';
import { ClassRoutes } from '../modules/class/class.routes';
import { RosterRoutes } from '../modules/roster/roster.routes';
import { AttendanceRoutes } from '../modules/attendance/attendance.routes';
import { MyRoutineRoutes, RoutineRoutes } from '../modules/routine/routine.routes';
import { ResourceRoutes } from '../modules/resource/resource.routes';
import { MarksRoutes } from '../modules/marks/marks.routes';
import { NoticeFeedRoutes, NoticeRoutes } from '../modules/notice/notice.routes';
import { ChatRoutes } from '../modules/chat/chat.routes';
import { PushRoutes } from '../modules/push/push.routes';
import { AuditRoutes } from '../modules/audit/audit.routes';
import { ReportRoutes } from '../modules/report/report.routes';
import { ReminderRoutes } from '../modules/reminder/reminder.routes';
import { NotificationRoutes } from '../modules/notification/notification.routes';
import { AdminRoutes } from '../modules/admin/admin.routes';
import { AiRoutes } from '../modules/ai/ai.routes';
import { FileRoutes } from '../modules/file/file.routes';
import { ClassworkRoutes, MyClassworkRoutes } from '../modules/classwork/classwork.routes';

const router = Router();

const moduleRoutes: { path: string; route: Router }[] = [
  { path: '/auth', route: AuthRoutes },
  { path: '/users', route: UserRoutes },
  { path: '/routine', route: MyRoutineRoutes },
  { path: '/notices', route: NoticeFeedRoutes },
  { path: '/chat', route: ChatRoutes },
  { path: '/push', route: PushRoutes },
  { path: '/reports', route: ReportRoutes },
  { path: '/files', route: FileRoutes },
  { path: '/ai', route: AiRoutes },
  { path: '/admin', route: AdminRoutes },
  { path: '/notifications', route: NotificationRoutes },
  { path: '/classwork', route: MyClassworkRoutes },
  // class-scoped modules (must come before the generic /classes router)
  { path: '/classes/:classId/roster', route: RosterRoutes },
  { path: '/classes/:classId/attendance', route: AttendanceRoutes },
  { path: '/classes/:classId/routine', route: RoutineRoutes },
  { path: '/classes/:classId/resources', route: ResourceRoutes },
  { path: '/classes/:classId/marks', route: MarksRoutes },
  { path: '/classes/:classId/notices', route: NoticeRoutes },
  { path: '/classes/:classId/audit', route: AuditRoutes },
  { path: '/classes/:classId/classwork', route: ClassworkRoutes },
  { path: '/classes/:classId/reminders', route: ReminderRoutes },
  { path: '/classes', route: ClassRoutes },
];

moduleRoutes.forEach(({ path, route }) => router.use(path, route));

export default router;
