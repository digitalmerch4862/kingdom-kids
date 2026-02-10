import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuestService, QuestStory } from '../services/quest.service';
import { db } from '../services/db.service';
import { MinistryService } from '../services/ministry.service';
import { GoogleGenAI } from '@google/genai';

// Mock the dependencies
vi.mock('../services/db.service', () => ({
  db: {
    getStudentById: vi.fn(),
    getStoryHistory: vi.fn(),
    addStoryHistory: vi.fn(),
  },
}));

vi.mock('../services/ministry.service', () => ({
  MinistryService: {
    getLeaderboard: vi.fn(),
    addPoints: vi.fn(),
  },
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(),
  Type: {
    OBJECT: 'object',
    STRING: 'string',
    ARRAY: 'array',
  },
}));

describe('QuestService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_KEY = 'test-api-key';
  });

  describe('generateStory', () => {
    it('should return fallback story if API_KEY is missing', async () => {
      process.env.API_KEY = '';
      
      const result = await QuestService.generateStory('student-1');
      
      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.quiz.length).toBeGreaterThanOrEqual(10);
      expect(result.quiz.length).toBeLessThanOrEqual(12);
    });

    it('should return fallback story if student not found', async () => {
      vi.mocked(db.getStudentById).mockResolvedValue(null);
      
      const result = await QuestService.generateStory('student-1');
      
      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.quiz.length).toBeGreaterThanOrEqual(10);
      expect(result.quiz.length).toBeLessThanOrEqual(12);
    });

    it('should generate a story successfully for Seed rank student', async () => {
      const mockStudent = {
        id: 'student-1',
        fullName: 'Test Student',
        ageGroup: '7-9',
        accessKey: 'KK-001',
      };

      const mockStory: QuestStory = {
        title: 'Daniel and the Lions',
        content: 'Daniel was a brave man who loved God...',
        quiz: [
          {
            q: 'What did Daniel do?',
            options: ['Prayed', 'Ran away', 'Fought', 'Slept'],
            a: 'Prayed',
          },
          {
            q: 'Who protected Daniel?',
            options: ['God', 'Soldiers', 'Friends', 'Lions'],
            a: 'God',
          },
          {
            q: 'What happened to the lions?',
            options: ['Ate Daniel', 'Fell asleep', 'Ran away', 'Roared'],
            a: 'Fell asleep',
          },
        ],
        topic: 'Daniel Lions',
      };

      vi.mocked(db.getStudentById).mockResolvedValue(mockStudent as any);
      vi.mocked(db.getStoryHistory).mockResolvedValue(['Moses']);
      vi.mocked(MinistryService.getLeaderboard).mockResolvedValue([
        { id: 'student-1', totalPoints: 50 } as any,
      ]);

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          title: mockStory.title,
          content: mockStory.content,
          quiz: mockStory.quiz,
          story_topic: mockStory.topic,
        }),
      });

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }) as any);

      const result = await QuestService.generateStory('student-1');

      expect(result).toEqual(mockStory);
      expect(db.addStoryHistory).toHaveBeenCalledWith('student-1', 'Daniel Lions');
    });

    it('should calculate correct rank based on points', async () => {
      const testCases = [
        { points: 0, expectedRank: 'Seed' },
        { points: 50, expectedRank: 'Seed' },
        { points: 100, expectedRank: 'Sprout' },
        { points: 300, expectedRank: 'Rooted' },
        { points: 600, expectedRank: 'Branch' },
        { points: 1000, expectedRank: 'Fruit Bearer' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        
        const mockStudent = {
          id: 'student-1',
          fullName: 'Test Student',
          ageGroup: '7-9',
          accessKey: 'KK-001',
        };

        vi.mocked(db.getStudentById).mockResolvedValue(mockStudent as any);
        vi.mocked(db.getStoryHistory).mockResolvedValue([]);
        vi.mocked(MinistryService.getLeaderboard).mockResolvedValue([
          { id: 'student-1', totalPoints: testCase.points } as any,
        ]);

        const mockGenerateContent = vi.fn().mockResolvedValue({
          text: JSON.stringify({
            title: 'Test Story',
            content: 'Test content',
            quiz: [
              { q: 'Q1', options: ['A', 'B', 'C', 'D'], a: 'A' },
              { q: 'Q2', options: ['A', 'B', 'C', 'D'], a: 'A' },
              { q: 'Q3', options: ['A', 'B', 'C', 'D'], a: 'A' },
            ],
            story_topic: 'Test Topic',
          }),
        });

        vi.mocked(GoogleGenAI).mockImplementation(() => ({
          models: {
            generateContent: mockGenerateContent,
          },
        }) as any);

        await QuestService.generateStory('student-1');

        const promptArg = mockGenerateContent.mock.calls[0][0];
        expect(promptArg.contents).toContain(`Rank: ${testCase.expectedRank}`);
      }
    });

    it('should return fallback story if AI response is empty', async () => {
      const mockStudent = {
        id: 'student-1',
        fullName: 'Test Student',
        ageGroup: '7-9',
        accessKey: 'KK-001',
      };

      vi.mocked(db.getStudentById).mockResolvedValue(mockStudent as any);
      vi.mocked(db.getStoryHistory).mockResolvedValue([]);
      vi.mocked(MinistryService.getLeaderboard).mockResolvedValue([
        { id: 'student-1', totalPoints: 0 } as any,
      ]);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: vi.fn().mockResolvedValue({ text: null }),
        },
      }) as any);

      const result = await QuestService.generateStory('student-1');
      
      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.quiz.length).toBeGreaterThanOrEqual(10);
      expect(result.quiz.length).toBeLessThanOrEqual(12);
    });

    it('should return fallback story on AI JSON parsing errors', async () => {
      const mockStudent = {
        id: 'student-1',
        fullName: 'Test Student',
        ageGroup: '7-9',
        accessKey: 'KK-001',
      };

      vi.mocked(db.getStudentById).mockResolvedValue(mockStudent as any);
      vi.mocked(db.getStoryHistory).mockResolvedValue([]);
      vi.mocked(MinistryService.getLeaderboard).mockResolvedValue([
        { id: 'student-1', totalPoints: 0 } as any,
      ]);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: vi.fn().mockResolvedValue({ text: 'invalid json' }),
        },
      }) as any);

      const result = await QuestService.generateStory('student-1');
      
      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.quiz.length).toBeGreaterThanOrEqual(10);
      expect(result.quiz.length).toBeLessThanOrEqual(12);
    });
  });

  describe('completeQuest', () => {
    it('should award points and update plant progress', async () => {
      vi.mocked(MinistryService.addPoints).mockResolvedValue({ id: 'entry-1' } as any);
      
      const result = await QuestService.completeQuest('student-1');

      expect(MinistryService.addPoints).toHaveBeenCalledWith(
        'student-1',
        'Daily Quest',
        5,
        'System',
        'Completed Daily Quest'
      );

      expect(localStorage.setItem).toHaveBeenCalled();
      expect(result).toHaveProperty('newStage');
      expect(result).toHaveProperty('newRankIndex');
    });

    it('should progress plant stage correctly', async () => {
      vi.mocked(MinistryService.addPoints).mockResolvedValue({ id: 'entry-1' } as any);
      
      // Mock existing progress at stage 80
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify({ stage: 80, rank: 0 })
      );

      const result = await QuestService.completeQuest('student-1');

      expect(result.newStage).toBe(0); // Should reset after reaching 100
      expect(result.newRankIndex).toBe(1); // Should advance rank
    });

    it('should cap rank at maximum', async () => {
      vi.mocked(MinistryService.addPoints).mockResolvedValue({ id: 'entry-1' } as any);
      
      // Mock max rank
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify({ stage: 80, rank: 4 }) // Fruit Bearer rank
      );

      const result = await QuestService.completeQuest('student-1');

      expect(result.newRankIndex).toBe(4); // Should stay at max rank
    });
  });
});
