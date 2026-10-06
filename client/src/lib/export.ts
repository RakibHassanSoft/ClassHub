'use client';

import * as XLSX from 'xlsx';

/** Download rows as an .xlsx file. First row = headers. */
export const downloadExcel = (fileName: string, sheets: { name: string; rows: (string | number | null)[][] }[]) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const widths = rows[0]?.map((_, col) => Math.min(40, Math.max(6, ...rows.map((r) => String(r[col] ?? '').length + 2))));
    ws['!cols'] = widths?.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  });
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
};

const HEADER_ALIASES: Record<string, string[]> = {
  studentId: [
    'studentid',
    'student id',
    'id',
    'roll',
    'roll no',
    'roll number',
    'reg',
    'reg no',
    'registration',
    'registration no',
    'student no',
    'matric',
  ],
  name: ['name', 'student name', 'full name', 'student'],
  email: ['email', 'e-mail', 'mail', 'email address'],
  phone: ['phone', 'mobile', 'contact', 'phone number', 'mobile no'],
  section: ['section', 'sec', 'group'],
};

const normalizeHeader = (h: string) =>
  h
    .toLowerCase()
    .replace(/[_.#:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Reads a CSV / XLS / XLSX file in the browser and maps common column names. */
export const readRosterFile = async (file: File) => {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });
  if (!rows.length) return { rows: [], unmatched: true };

  const headers = Object.keys(rows[0]);
  const map: Record<string, string> = {};
  headers.forEach((h) => {
    const n = normalizeHeader(h);
    Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
      if (!map[field] && aliases.includes(n)) map[field] = h;
    });
  });

  // fall back to first two columns = id, name
  if (!map.studentId && headers[0]) map.studentId = headers[0];
  if (!map.name && headers[1]) map.name = headers[1];

  const parsed = rows
    .map((r) => ({
      studentId: String(r[map.studentId] ?? '').trim(),
      name: String(r[map.name] ?? '').trim(),
      email: map.email ? String(r[map.email] ?? '').trim() || undefined : undefined,
      phone: map.phone ? String(r[map.phone] ?? '').trim() || undefined : undefined,
      section: map.section ? String(r[map.section] ?? '').trim() || undefined : undefined,
    }))
    .filter((r) => r.studentId || r.name);

  return { rows: parsed, unmatched: false };
};
