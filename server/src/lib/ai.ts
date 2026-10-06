import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';

let client: GoogleGenAI | null = null;
export const aiEnabled = () => Boolean(env.geminiApiKey);

const getClient = () => {
  client ??= new GoogleGenAI({
    apiKey: env.geminiApiKey,
    ...(env.geminiBaseUrl ? { httpOptions: { baseUrl: env.geminiBaseUrl } } : {}),
  });
  return client;
};

/** One-shot text generation. Returns null when AI is not configured or the call fails. */
export const generateText = async (prompt: string, opts: { maxTokens?: number; temperature?: number } = {}) => {
  if (!aiEnabled()) return null;
  try {
    const res = await getClient().models.generateContent({
      model: env.geminiModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: opts.temperature ?? 0.3, maxOutputTokens: opts.maxTokens ?? 400 },
    });
    const text = res.text?.trim();
    return text || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Gemini error:', (err as Error).message);
    return null;
  }
};

/** Short summary of a long teacher message/notice so students get the point at a glance. */
export const summarize = (text: string) =>
  generateText(
    `Summarize this message from a teacher to students in at most 2 short sentences (max 40 words).
Keep every date, time, room, deadline and number exactly. Write in the same language as the message. No intro, no bullet points.

Message:
"""${text.slice(0, 6000)}"""`,
    { maxTokens: 160, temperature: 0.2 },
  );

export const COMPOSE_MODES = ['polish', 'english', 'shorter', 'polite'] as const;
export type ComposeMode = (typeof COMPOSE_MODES)[number];

const INSTRUCTIONS: Record<ComposeMode, string> = {
  polish: 'Rewrite it so it is clear, correct and respectful. Fix grammar and spelling. Keep the meaning and language.',
  english: 'Translate it into clear, simple, respectful English (it may be Bangla, Banglish or mixed). Keep the meaning.',
  shorter: 'Make it shorter and to the point while keeping all important details.',
  polite: 'Make it more polite and formal, suitable for writing to a teacher. Keep the meaning.',
};

/** Helps a student (or teacher) write a message. Returns only the rewritten message. */
export const composeHelp = (text: string, mode: ComposeMode, role: 'teacher' | 'student') =>
  generateText(
    `You help a ${role} at a university write a chat message in an education app.
${INSTRUCTIONS[mode]}
Return ONLY the final message text, without quotes or explanations. Do not add greetings or names that are not in the original.

Message:
"""${text.slice(0, 3000)}"""`,
    { maxTokens: 500, temperature: 0.4 },
  );
