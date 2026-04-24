import { describe, it, expect } from 'vitest';
import { parseContent, toContentStructure } from '../utils/lessonMarkdown';

const SAMPLE = `
# Read
## The Word
Some bible text here.
## Context
Background info.

# Teach
## Key Points
Main lesson points.

# Engage
## Activity
Do the craft.
`.trim();

describe('parseContent', () => {
  it('splits into top-level sections', () => {
    const sections = parseContent(SAMPLE);
    expect(sections).toHaveLength(3);
    expect(sections[0].title).toBe('Read');
    expect(sections[1].title).toBe('Teach');
    expect(sections[2].title).toBe('Engage');
  });

  it('splits subsections correctly', () => {
    const sections = parseContent(SAMPLE);
    expect(sections[0].subsections).toHaveLength(2);
    expect(sections[0].subsections[0].title).toBe('The Word');
    expect(sections[0].subsections[0].content).toBe('Some bible text here.');
  });

  it('returns empty array for empty string', () => {
    expect(parseContent('')).toEqual([]);
  });
});

describe('toContentStructure', () => {
  it('maps Read section to read pillar', () => {
    const s = toContentStructure(SAMPLE);
    expect(s.read).toHaveLength(2);
    expect(s.teach).toHaveLength(1);
    expect(s.engage).toHaveLength(1);
  });

  it('teach catches unknown sections', () => {
    const content = '# Introduction\n## Intro\nHello world.';
    const s = toContentStructure(content);
    expect(s.teach).toHaveLength(1);
    expect(s.teach[0].title).toBe('Intro');
  });
});
