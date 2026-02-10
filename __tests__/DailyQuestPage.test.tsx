import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DailyQuestPage from '../pages/DailyQuestPage';
import { QuestService, QuestStory } from '../services/quest.service';
import { audio } from '../services/audio.service';
import React from 'react';

// Mock the quest service
vi.mock('../services/quest.service', () => ({
  QuestService: {
    generateStory: vi.fn(),
    completeQuest: vi.fn(),
  },
}));

// Mock audio service
vi.mock('../services/audio.service', () => ({
  audio: {
    playClick: vi.fn(),
    playYehey: vi.fn(),
  },
}));

describe('DailyQuestPage', () => {
  const mockUser = {
    id: 'user-1',
    studentId: 'student-1',
    fullName: 'Test User',
    role: 'student',
  };

  // Generate 10 questions for a wave
  const generateMockQuiz = (count: number = 10) => {
    return Array.from({ length: count }, (_, i) => ({
      q: `Question ${i + 1}?`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      a: 'Option A',
    }));
  };

  const mockStory: QuestStory = {
    title: 'Test Story',
    content: 'Test story content.',
    quiz: generateMockQuiz(10),
    topic: 'Test Topic',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show loading state initially', async () => {
    vi.useRealTimers();
    vi.mocked(QuestService.generateStory).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(
      <BrowserRouter>
        <DailyQuestPage user={mockUser as any} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Loading Wave 1/i)).toBeInTheDocument();
    });
  });

  it('should display story after loading', async () => {
    vi.useRealTimers();
    vi.mocked(QuestService.generateStory).mockResolvedValue(mockStory);

    render(
      <BrowserRouter>
        <DailyQuestPage user={mockUser as any} />
      </BrowserRouter>
    );

    // Wait for the story to load and "Start Quiz" button to appear
    await waitFor(() => {
      const startButton = screen.queryByText(/Start Quiz/i);
      expect(startButton).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should handle loading error and show retry button', async () => {
    vi.useRealTimers();
    vi.mocked(QuestService.generateStory).mockRejectedValue(new Error('API Error'));

    render(
      <BrowserRouter>
        <DailyQuestPage user={mockUser as any} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Oops! The magic didn't work/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    const retryButton = screen.getByRole('button', { name: /Try Again/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('should work with guest users', async () => {
    vi.useRealTimers();
    const guestUser = {
      id: 'guest-1',
      studentId: 'GUEST_DEMO',
      fullName: 'Guest User',
      role: 'guest',
    };

    vi.mocked(QuestService.generateStory).mockResolvedValue(mockStory);

    render(
      <BrowserRouter>
        <DailyQuestPage user={guestUser as any} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Start Quiz/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(QuestService.generateStory).toHaveBeenCalledWith('GUEST_DEMO');
  });
});
