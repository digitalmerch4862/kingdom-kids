/**
 * Gemini AI stubs for Faith Pathway lesson authoring.
 *
 * The original kk-faith-pathway used a Gemini API key that is not available in
 * this repo. These stubs preserve the UI affordances without crashing; upgrade
 * to real calls by replacing the bodies and adding VITE_GEMINI_API_KEY to .env.
 */

export interface GeneratedLesson {
  title: string;
  objective: string;
  scripture: string;
  the_hook: string;
  the_lesson: string[];
  gospel_connection: string;
  closing_prayer: string;
  group_activity: string;
}

export async function generateFullLesson(
  _goal: string,
  _existingContext: string
): Promise<GeneratedLesson | null> {
  console.warn('[gemini-lesson] generateFullLesson is a stub — Gemini API not configured.');
  return null;
}

export async function categorizeLessonTitle(title: string): Promise<string> {
  console.warn('[gemini-lesson] categorizeLessonTitle is a stub — returning default.');
  const t = title.toLowerCase();
  if (t.includes('genesis') || t.includes('exodus') || t.includes('deuteronomy') || t.includes('leviticus') || t.includes('numbers')) return 'PENTATEUCH';
  if (t.includes('matthew') || t.includes('mark') || t.includes('luke') || t.includes('john')) return 'THE GOSPELS';
  if (t.includes('acts') || t.includes('romans') || t.includes('corinthians')) return 'ACTS & EPISTLES';
  if (t.includes('revelation')) return 'REVELATION';
  if (t.includes('psalms') || t.includes('proverbs') || t.includes('job') || t.includes('ecclesiastes')) return 'POETRY';
  if (t.includes('isaiah') || t.includes('jeremiah') || t.includes('ezekiel')) return 'THE PROPHETS';
  return 'HISTORY';
}

export async function generateLessonSummary(
  _title: string,
  _content: string
): Promise<string | null> {
  console.warn('[gemini-lesson] generateLessonSummary is a stub — Gemini API not configured.');
  return null;
}
