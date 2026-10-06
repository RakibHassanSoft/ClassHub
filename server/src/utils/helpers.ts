import crypto from 'crypto';

/** Readable join code without confusing characters (0/O, 1/I/L). */
export const generateJoinCode = (length = 7): string => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) code += alphabet[bytes[i] % alphabet.length];
  return code;
};

export const normalizeStudentId = (id: string): string => id.trim().toUpperCase().replace(/\s+/g, '');

/** YYYY-MM-DD validation (calendar date, no time zone shifts). */
export const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Loose key for matching IDs typed differently: "cse-101", "CSE 101" and "CSE101" all match. */
export const studentIdKey = (id: string): string => id.toUpperCase().replace(/[^A-Z0-9]/g, '');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-05" -> "5 Oct 2026" */
export const prettyDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : iso;
};
