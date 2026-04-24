/**
 * Parses lesson `content` (Markdown) into structured sections.
 *
 * Format:
 *   # Section Title        ← H1 = top-level pillar (Read / Teach / Engage)
 *   ## Sub-section Title   ← H2 = individual card
 *   Body text…
 */

import type { LessonSubSection, LessonContentStructure } from '../types';

export interface ParsedSection {
  id: string;
  title: string;
  subsections: LessonSubSection[];
}

/** Parse raw markdown into an array of top-level sections with subsections. */
export function parseContent(content: string): ParsedSection[] {
  const parsed: ParsedSection[] = [];
  const mainParts = content.split(/^# /m).filter(p => p.trim());

  mainParts.forEach((part, index) => {
    const lines = part.split('\n');
    const title = lines[0].trim();
    const sectionId = `section-${index}`;

    const body = part.slice(title.length);
    const subParts = body.split(/^## /m).filter(p => p.trim());

    const subsections: LessonSubSection[] = subParts.map((sub, sIdx) => {
      const subLines = sub.split('\n');
      const subTitle = subLines[0].trim();
      const subContent = subLines.slice(1).join('\n').trim();
      return { id: `${sectionId}-sub-${sIdx}`, title: subTitle, content: subContent };
    });

    parsed.push({ id: sectionId, title, subsections });
  });

  return parsed;
}

/**
 * Map parsed sections into the three-pillar structure.
 * Sections whose title contains "read" → read pillar,
 * "teach" / "preach" → teach,
 * "engage" / "activity" → engage.
 * All others go into the closest matched pillar (order: read, teach, engage).
 */
export function toContentStructure(content: string): LessonContentStructure {
  const sections = parseContent(content);
  const result: LessonContentStructure = { read: [], teach: [], engage: [] };

  sections.forEach(section => {
    const t = section.title.toLowerCase();
    const bucket: keyof LessonContentStructure =
      t.includes('read') || t.includes('bible') || t.includes('text') ? 'read'
      : t.includes('engage') || t.includes('activity') || t.includes('game') ? 'engage'
      : 'teach';

    section.subsections.forEach(sub => result[bucket].push(sub));
  });

  return result;
}
