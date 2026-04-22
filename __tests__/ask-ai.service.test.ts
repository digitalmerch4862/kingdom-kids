import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AskAIService, normalizeAskAIResponse } from '../services/ask-ai.service';
import { db } from '../services/db.service';
import { MinistryService } from '../services/ministry.service';

vi.mock('../services/db.service', () => ({
  db: {
    getStudents: vi.fn(),
    getAttendance: vi.fn(),
    getPointsLedger: vi.fn(),
  },
}));

vi.mock('../services/ministry.service', () => ({
  MinistryService: {
    addPoints: vi.fn(),
    getLeaderboard: vi.fn(),
  },
}));

describe('normalizeAskAIResponse', () => {
  it('maps a read-only answer into a safe UI state', () => {
    const result = normalizeAskAIResponse({
      mode: 'answer',
      reply: '3 students are absent today.',
      citations: ['attendance'],
    } as any);

    expect(result.mode).toBe('answer');
    expect(result.reply).toContain('absent');
    expect(result.pendingAction).toBeNull();
  });

  it('maps an add-points action into a confirmation payload', () => {
    const result = normalizeAskAIResponse({
      mode: 'confirm',
      reply: 'Add 5 points to Joshua for memory verse?',
      pendingAction: {
        type: 'add_points',
        studentId: 'student-1',
        studentName: 'Joshua',
        points: 5,
        category: 'Memory Verse',
        notes: 'AI drafted action',
      },
    } as any);

    expect(result.mode).toBe('confirm');
    expect(result.pendingAction?.type).toBe('add_points');
    expect(result.pendingAction?.points).toBe(5);
  });
});

describe('AskAIService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a normalized answer payload for absences', async () => {
    vi.mocked(db.getStudents).mockResolvedValue([
      { id: 'student-1', fullName: 'Joshua Cruz', studentStatus: 'active', accessKey: '2026001' },
      { id: 'student-2', fullName: 'Anna Lee', studentStatus: 'active', accessKey: '2026002' },
    ] as any);
    vi.mocked(db.getAttendance).mockResolvedValue([
      { id: 'a1', studentId: 'student-2', sessionDate: new Date().toISOString().split('T')[0] },
    ] as any);

    const result = await AskAIService.ask({
      prompt: 'Who is absent today?',
      actor: { role: 'ADMIN', username: 'RAD' },
    });

    expect(result.mode).toBe('answer');
    expect(result.reply).toContain('absent');
    expect(result.citations).toContain('attendance');
  });

  it('drafts a confirmation payload for add points', async () => {
    vi.mocked(db.getStudents).mockResolvedValue([
      { id: 'student-1', fullName: 'Joshua Cruz', studentStatus: 'active', accessKey: '2026001' },
    ] as any);

    const result = await AskAIService.ask({
      prompt: 'Add 5 points to Joshua for Memory Verse',
      actor: { role: 'ADMIN', username: 'RAD' },
    });

    expect(result.mode).toBe('confirm');
    expect(result.pendingAction?.studentId).toBe('student-1');
    expect(result.pendingAction?.points).toBe(5);
  });

  it('executes confirmed add points through MinistryService', async () => {
    vi.mocked(MinistryService.addPoints).mockResolvedValue({ id: 'entry-1' } as any);

    await AskAIService.executeAddPoints({
      type: 'add_points',
      studentId: 'student-1',
      studentName: 'Joshua Cruz',
      points: 5,
      category: 'Memory Verse',
      notes: 'AI drafted action',
      actor: 'RAD',
    });

    expect(MinistryService.addPoints).toHaveBeenCalledWith(
      'student-1',
      'Memory Verse',
      5,
      'RAD',
      'AI drafted action'
    );
  });
});
