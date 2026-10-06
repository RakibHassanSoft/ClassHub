# ClassHub

Attendance, routine, Google Drive resources, marks, notices and live chat for teachers and students —
installable on phones as an app. Everything runs on free tiers. Two separate projects:

| Folder | Stack | Runs on |
| --- | --- | --- |
| `server/` | Node.js, Express 5, TypeScript, Mongoose (MongoDB Atlas), Zod, Gemini API | http://localhost:5000 |
| `client/` | Next.js 16 (App Router), React 19, Tailwind CSS 4, TanStack Query, Zustand, installable PWA | http://localhost:3000 |

## 1. Run it locally

Requirements: Node.js 20 or newer.

```bash
# terminal 1 – API
cd server
npm install
# check server/.env (MongoDB URI, JWT secret, Gemini key)
npm run dev

# terminal 2 – web app
cd client
npm install
npm run dev
```

Open http://localhost:3000, create a teacher account, create a class, add students, share the invite link.

### Environment variables

`server/.env` (copy from `.env.example`)

| Key | What it is |
| --- | --- |
| `MONGODB_URI` | Atlas connection string. Keep `/classhub` (database name) before the `?`. |
| `JWT_SECRET` | Long random string used to sign logins. |
| `JWT_EXPIRES_IN` | Login lifetime, default `7d`. |
| `ALLOWED_EMAIL_DOMAINS` | Email domains allowed at sign-up. Default `gmail.com` (Gmail only). Several: `gmail.com,pu.edu.bd`. `*` = any email. |
| `TEACHER_APPROVAL` | `on` (default): new teachers wait until an admin approves them. `off` skips verification (not recommended). |
| `GEMINI_API_KEY` | From https://aistudio.google.com/apikey (free). Powers: class list import from PDF, short AI summaries of long teacher messages/notices, and the AI "help me write" button in chat. Everything else works without it. |
| `GEMINI_MODEL` | Default `gemini-flash-latest`. Any Gemini model that reads PDFs works. |
| `CLIENT_URL` | Allowed web origins, comma separated (e.g. `http://localhost:3000,https://classhub.vercel.app`). |
| `APP_URL` | Public URL of the web app, used in emails and notification links. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Phone notifications (Web Push). Generate a pair with `npx web-push generate-vapid-keys`. Keep the private key secret. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | Optional. Emails urgent and class-cancelled notices. Gmail: `smtp.gmail.com`, port `587`, and an App Password (Google Account → Security → App passwords). |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `CLOUDINARY_FOLDER` | File storage (PDF, Word, PowerPoint, Excel, ZIP, images) for classwork, homework submissions and chat. Cloudinary dashboard → *Product environment* → API keys. If the cloud name is empty, files are saved on the API server's disk instead (`UPLOAD_DIR`, fine for local use, not for Render). |
| `PUBLIC_API_URL` / `UPLOAD_DIR` / `MAX_UPLOAD_MB` | Only for disk storage: public URL of the API, folder for files, size limit per file (default 10 MB). |
| `TIMEZONE` | Time zone of the class times and reminders, default `Asia/Dhaka`. |
| `REMINDERS` | Set to `off` to stop the automatic class reminders (default on). |
| `AUTH_RATE_LIMIT` | Optional. Login/sign-up attempts per 15 minutes per IP (default 30). |

`client/.env.local`

| Key | What it is |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL, e.g. `http://localhost:5000/api/v1`. |
### Create the admin

The admin verifies teachers. Create the first admin from the `server` folder (uses `MONGODB_URI` from `.env`):

```bash
npm run create-admin -- admin@gmail.com "Your Name" StrongPassword1
```

Then log in at `/login` with that email and password — you land on the **Admin panel**. Run the command again with another email to add more admins
(an existing account with that email is turned into an admin and gets the new password). On Render: *Shell* tab → `npm run create-admin -- …`.

### MongoDB Atlas checklist

1. Atlas → **Network Access** → add your IP (and `0.0.0.0/0` later for Render).
2. Atlas → **Database Access** → use a strong password. The password shared in chat (`rakib`) should be changed; then update `MONGODB_URI`.

## 2. Code structure

```
server/src/
  config/            env.ts, db.ts
  middlewares/       auth (JWT + roles), validate (Zod), errorHandler
  utils/             ApiError, catchAsync, sendResponse, helpers
  modules/           one folder per feature: model · validation · service · controller · routes
    user/  auth/  class/  roster/  attendance/  routine/  resource/  marks/  notice/
    chat/  push/  audit/  report/  file/  classwork/  ai/  notification/  reminder/
  routes/index.ts    mounts every module under /api/v1
  app.ts  server.ts

client/src/
  app/               pages (App Router)
    (auth)/login, (auth)/register
    (app)/dashboard, classes, classes/[classId]/{attendance,routine,classwork,chat,marks,students,settings}
    (app)/messages    WhatsApp-style chats
    (app)/routine, notifications, profile
    join/[code]       invite page
    manifest.ts       PWA manifest
  components/ui      button, input, card, dialog, menu, badge…
  components/layout  app shell, logo, notification bell, install button
  components/class   class-specific widgets (incl. class times editor, reminders card)
  components/chat    chat thread, composer (files, polls, AI), polls
  components/classwork  classwork composer, cards, submissions
  hooks/queries.ts   all API queries in one place
  lib/               api client, auth store, types, colours, Excel export
public/              sw.js (service worker), offline.html, icons
```

To change a feature, open its module folder in `server/src/modules/<feature>` and its page in
`client/src/app/(app)/classes/[classId]/<feature>`.

## 3. API overview (`/api/v1`)

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register` (student: `name, email, password, studentId, department?, institution?`; teacher: `name, email, password, employeeId, department, institution?` → starts as *pending*), `POST /auth/login` `{ identifier, password }` (Gmail or register ID), `GET /auth/config` |
| Admin (admin only) | `GET /admin/stats`, `GET /admin/users?role=teacher\|student&status=pending\|approved\|rejected&search=`, `PATCH /admin/teachers/:id` `{ status: approved\|rejected, note? }`, `PATCH /admin/users/:id/active` `{ isActive }` |
| User | `GET/PATCH /users/me`, `PATCH /users/me/password` |
| Classes | `GET/POST /classes`, `GET/PATCH/DELETE /classes/:id`, `POST /classes/:id/join-code/reset`, `POST /classes/:id/leave`, `POST /classes/:id/clone` (template) |
| People & roles | `GET /classes/:id/people`, `POST /classes/:id/teachers` `{ email }`, `DELETE /classes/:id/teachers/:userId`, `PATCH /classes/:id/members/:userId` `{ isCR }` |
| Join | `GET /classes/join/:code` (preview: on list? can join?), `POST /classes/join/:code` (register ID comes from the account) |
| Class list | `GET/POST /classes/:id/roster`, `POST /roster/bulk`, `POST /roster/ai-extract` (multipart `file`), `PATCH/DELETE /roster/:entryId`, `POST /roster/:entryId/unlink` |
| Attendance | `GET/POST /classes/:id/attendance`, `GET/PATCH/DELETE /attendance/:sessionId`, `GET /attendance/me`, `GET /attendance/analytics` |
| Self check-in | `POST /attendance/:sessionId/checkin/start` `{ minutes }`, `POST …/checkin/stop`, `GET …/checkin`, `POST …/checkin` `{ code }`, `GET /attendance/checkin/active` |
| Routine | `GET/POST /classes/:id/routine`, `PATCH/DELETE /routine/:slotId`, `GET /routine/me` |
| Resources | `GET/POST /classes/:id/resources`, `PATCH/DELETE /resources/:resourceId` |
| Marks | `GET/POST /classes/:id/marks`, `PATCH/DELETE /marks/:assessmentId`, `PUT /marks/:assessmentId/scores`, `GET /marks/me` |
| Notices | `GET/POST /classes/:id/notices`, `PATCH/DELETE /notices/:noticeId`, `POST /notices/:noticeId/seen`, `GET /notices/feed`, `POST /notices/feed/seen-all` |
| Chat | `GET /chat/conversations`, `GET /chat/class/:classId`, `GET /chat/contacts?classId=`, `POST /chat/direct`, `GET /chat/conversations/:id`, `GET /chat/conversations/:id/messages` (+ read states), `POST /chat/conversations/:id/messages` `{ text?, attachmentIds?, replyTo?, poll? }`, `POST /chat/conversations/:id/read`, `POST /chat/messages/:id/vote` `{ optionIds }`, `POST /chat/messages/:id/close-poll`, `DELETE /chat/messages/:id` |
| Files | `POST /files` (multipart `file`, `classId`), `GET /files/config`, `DELETE /files/:id` |
| Classwork | `GET/POST /classes/:id/classwork` (class diary, homework, class test, exam syllabus, material), `GET/PATCH/DELETE /classwork/:workId`, `POST/DELETE /classwork/:workId/submission`, `GET /classwork/:workId/submissions`, `PATCH /classwork/:workId/submissions/:submissionId` (grade), `GET /classwork/upcoming` (all my classes) |
| AI | `GET /ai/status`, `POST /ai/compose` `{ text, mode: polish \| english \| polite \| shorter }` |
| Reminders | `GET /classes/:id/reminders` (settings, next reminders, cancelled classes), `POST /classes/:id/reminders/test`, `POST /classes/:id/reminders/days-off` `{ date, slotId?, reason?, notify? }`, `DELETE /classes/:id/reminders/days-off/:id`; settings via `PATCH /classes/:id` `{ settings: { reminders } }` |
| Notifications | Reminders are merged into `GET /notices/feed`; `POST /notifications/:id/read` |
| Push | `GET /push/config`, `POST /push/subscribe`, `POST /push/unsubscribe`, `POST /push/test` |
| Activity log | `GET /classes/:id/audit?entity=&before=` |
| Reports | `GET /reports/semester?classIds=a,b` |

Real-time events (Socket.IO on the API origin, auth with the JWT): `message:new`, `message:updated` (poll votes, AI summary),
`message:deleted`, `conversation:read`, `typing`, `notice:new`, `notice:updated`, `notification:new` (reminders),
`classwork:new`, `classwork:updated`, `submission:new`, `submission:graded`, `checkin:open`, `checkin:closed`, `checkin:new`.

All responses: `{ success, message, data }`. Errors: `{ success: false, message, errors? }`.

## 4. How signing up and joining work (Google Classroom style)

1. **Students sign up** with full name, **register ID**, **Gmail** and a password. They log in with the Gmail or the register ID
   (any format: `CSE-2201-045`, `cse 2201 045`). One account per register ID and per email.
2. **Teachers sign up** with full name, Gmail, password, **employee ID** and department. The account is *waiting for verification*:
   the admin checks the details in the **Admin panel** and approves (or rejects with a reason). The teacher gets a notification
   (and an email if SMTP is set) and can then create classes and add the class list
   (AI from PDF/photo, CSV/Excel, or manual).
3. The teacher opens **Invite** and shows the **class code** or **QR code** (there is a projector view), or shares the link.
4. The student taps **Join a class** and types the code or taps **Scan QR**. Their register ID is taken from their account —
   nobody types it again.
5. A student can join **only if their register ID is on the teacher's Students list**. Otherwise the join page says
   "Your register ID is not on this class list yet — ask your teacher to add it", and they can try again after the teacher adds it.
6. After joining, every course the student belongs to shows on their dashboard and in **My classes**, with all the notices,
   routine, resources, attendance and published marks the teacher adds.

## 5. Deploy for free

| Part | Where | Settings |
| --- | --- | --- |
| API | Render → New Web Service → root `server` | Build `npm install && npm run build`, Start `npm start`, add the `.env` keys, set `NODE_ENV=production`, `CLIENT_URL=https://<your-vercel-domain>` |
| Web | Vercel → import repo → root `client` | Env `NEXT_PUBLIC_API_URL=https://<render-app>.onrender.com/api/v1` |
| DB | MongoDB Atlas M0 | Network access `0.0.0.0/0` (Render IPs change) |

The PWA "Install app" button appears automatically over HTTPS (Vercel). On iPhone: Safari → Share → Add to Home Screen.

## 6. What's included

| Phase | Features |
| --- | --- |
| 1 · Core | Accounts, classes, verified join link, class list (manual / CSV / Excel / Gemini PDF), attendance with custom statuses + Excel/print, routine, Google Drive resources, marks with weights and publish, notices + notification feed, installable PWA |
| 2 · Communication | Live class group chat + private teacher–student chat (typing, unread badges, delete), phone/desktop push notifications, email for urgent and cancelled-class notices, activity log of every change |
| 3 · Insights & roles | Attendance insights (trend, weekdays, at-risk students, absence streaks), semester Excel export across classes, co-teachers, class representatives |
| 4 · Classroom tools | Self check-in with a rotating 4-digit code and QR (projector view), attendance saved offline and synced later, new classes from a template |
| 5 · Classwork | Daily class diary (topic covered + files), homework with deadline and online submission (late flag, grading, feedback, deadline changes), class test announcements, mid/final syllabus, materials (upload PDF/Word/PPT/ZIP or Drive links); every post appears as a card in the class chat |
| 6 · Chat + AI | WhatsApp-style chat: photos, PDF/Word/PPT/Excel/ZIP, links with preview, polls (teachers/CRs), reply, read ticks, emoji; AI short summary under long teacher messages and notices; AI "help me write" (fix, English, polite, shorter) |
| 7 · Class times & reminders | Class days and start/end times when creating a class; automatic reminder the evening before (tomorrow's class, homework due, class tests) and before each class (default 1 hour); teacher can change times, turn reminders on/off, cancel a class day (students are told, reminders skipped), send a test |
| 8 · Admin & verification | Gmail + password accounts; students give their register ID, teachers their employee ID and department; admin panel to approve/reject teachers (with reason), search, disable/enable accounts; joining only with a listed register ID |

### Roles

| Role | Can |
| --- | --- |
| Admin | Approves or rejects teachers, disables/enables accounts, sees totals. Has no classes of its own |
| Owner (teacher who created the class) | Everything, including adding/removing co-teachers and deleting the class |
| Co-teacher | Everything except deleting the class and managing teachers |
| Class representative (a student) | Post notices (not urgent), edit their own notices, write in teacher-only chat |
| Student | See class content, own attendance and published marks, chat, check in |

## 7. Notes

- **Phone notifications** need HTTPS (Vercel gives this) and the user must tap **Turn on** once per device. On iPhone, install the app to the home screen first (iOS 16.4+).
- **Self check-in** codes change every 30 seconds and the previous code still works, so a code shared outside the room expires almost immediately. Each student account is bound to one student ID.
- **Offline attendance**: if the connection drops while you are on an attendance sheet, Save keeps the marks on that device and sends them automatically when you are back online.
- **Without a Gemini key** everything works except the AI parts (PDF class-list import, summaries, AI writing help). The AI button is hidden when no key is set.
- **Class reminders** are sent by the API every minute (time zone `TIMEZONE`). On Render's free plan the API sleeps after 15 minutes without traffic, so reminders would be late. Keep it awake for free: create a monitor at https://uptimerobot.com (or https://cron-job.org) that opens `https://<render-app>.onrender.com/api/v1/health` every 10 minutes. A reminder that was missed while sleeping is still sent when the API wakes up (up to the class start / 2 hours after the evening time), and never twice.
- **Files**: allowed types are PDF, Word, PowerPoint, Excel/CSV, TXT, ZIP/RAR/7z and images, up to `MAX_UPLOAD_MB` each.
