import { GoogleGenAI, Type } from '@google/genai';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { normalizeStudentId } from '../../utils/helpers';

export const AI_ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export interface ExtractedStudent {
  studentId: string;
  name: string;
  email?: string;
  phone?: string;
  section?: string;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
}

const PROMPT = `You are reading a class roster (list of students) for a university or school teacher.
Extract EVERY student row in the document, in the order they appear.
Rules:
- studentId: the student's ID / roll / registration number exactly as printed (keep dashes and letters). Never invent one.
- name: the student's full name, in normal capitalisation.
- email, phone, section: only if clearly present for that student, otherwise omit.
- confidence: "high" when the row is clearly readable, "medium" if something is slightly unclear, "low" if you had to guess any character.
- Ignore headers, serial numbers, signatures, totals and page footers.
- If the document has no student list, return an empty students array and explain in notes.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    students: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          studentId: { type: Type.STRING },
          name: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          section: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['studentId', 'name', 'confidence'],
        propertyOrdering: ['studentId', 'name', 'email', 'phone', 'section', 'confidence'],
      },
    },
    notes: { type: Type.STRING },
  },
  required: ['students'],
};

let client: GoogleGenAI | null = null;
const getClient = () => {
  if (!env.geminiApiKey) {
    throw new ApiError(503, 'AI import is not configured yet. Add GEMINI_API_KEY to the server .env file.');
  }
  client ??= new GoogleGenAI({
    apiKey: env.geminiApiKey,
    ...(env.geminiBaseUrl ? { httpOptions: { baseUrl: env.geminiBaseUrl } } : {}),
  });
  return client;
};

export const extractRosterWithAI = async (
  file: Express.Multer.File,
  existingIds: Set<string>,
): Promise<{ students: ExtractedStudent[]; notes?: string; model: string }> => {
  if (!AI_ALLOWED_MIME.includes(file.mimetype)) {
    throw ApiError.badRequest('Upload a PDF or an image (PNG, JPG, WEBP) of the student list');
  }

  let raw: string | undefined;
  try {
    const response = await getClient().models.generateContent({
      model: env.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: file.mimetype, data: file.buffer.toString('base64') } }, { text: PROMPT }],
        },
      ],
      config: { responseMimeType: 'application/json', responseSchema, temperature: 0 },
    });
    raw = response.text;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // eslint-disable-next-line no-console
    console.error('Gemini error', err);
    throw new ApiError(502, 'The AI service could not read this file. Try again, or upload a clearer PDF / CSV.');
  }

  let parsed: { students?: Partial<ExtractedStudent>[]; notes?: string };
  try {
    parsed = JSON.parse(raw ?? '{}');
  } catch {
    throw new ApiError(502, 'The AI returned an unreadable answer. Please try again.');
  }

  const seen = new Map<string, number>();
  const students: ExtractedStudent[] = (parsed.students ?? [])
    .filter((s) => s && (s.studentId || s.name))
    .map((s) => {
      const studentId = normalizeStudentId(String(s.studentId ?? ''));
      const issues: string[] = [];
      if (!studentId) issues.push('Missing ID');
      if (!s.name?.trim()) issues.push('Missing name');
      if (studentId && existingIds.has(studentId)) issues.push('Already in class');
      seen.set(studentId, (seen.get(studentId) ?? 0) + 1);
      return {
        studentId,
        name: String(s.name ?? '').trim(),
        email: s.email?.trim() || undefined,
        phone: s.phone?.trim() || undefined,
        section: s.section?.trim() || undefined,
        confidence: (['high', 'medium', 'low'].includes(String(s.confidence))
          ? s.confidence
          : 'medium') as ExtractedStudent['confidence'],
        issues,
      };
    });

  students.forEach((s) => {
    if (s.studentId && (seen.get(s.studentId) ?? 0) > 1) s.issues.push('Duplicate ID in file');
  });

  return { students, notes: parsed.notes, model: env.geminiModel };
};
