import { env } from '../config/env';

/** Calendar parts of an instant in the app time zone (default Asia/Dhaka). */
export const localParts = (at: Date = new Date(), tz = env.timezone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: days.indexOf(parts.weekday),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

/** "YYYY-MM-DD" + n days. */
export const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};

export const weekdayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** The UTC instant of a local date + minutes in the app time zone. */
export const zonedToUtc = (iso: string, minutes: number, tz = env.timezone) => {
  const [y, m, d] = iso.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  // offset of the zone at that moment (twice for DST edges)
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(ts), tz);
    const [py, pm, pd] = p.date.split('-').map(Number);
    const asUtc = Date.UTC(py, pm - 1, pd, Math.floor(p.minutes / 60), p.minutes % 60);
    ts = guess - (asUtc - ts);
  }
  return new Date(ts);
};

/** "14:30" -> "2:30 PM" */
export const formatClock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
};

export const formatInstant = (at: Date, tz = env.timezone) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(at);
