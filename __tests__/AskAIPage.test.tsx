import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AskAIPage from '../pages/AskAIPage';
import { AskAIService } from '../services/ask-ai.service';

vi.mock('../services/ask-ai.service', () => ({
  AskAIService: {
    ask: vi.fn(),
    executeAddPoints: vi.fn(),
  },
}));

vi.mock('../services/audio.service', () => ({
  audio: {
    playClick: vi.fn(),
    playYehey: vi.fn(),
  },
}));

describe('AskAIPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the personalized heading and prompt box', () => {
    render(
      <MemoryRouter>
        <AskAIPage user={{ role: 'ADMIN', username: 'maggie' } as any} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /How can I help, Maggie\?/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument();
    expect(screen.getByText(/How To Use Me/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is saved until an allowed user presses/i)).toBeInTheDocument();
  });

  it('submits a prompt and renders the AI answer', async () => {
    vi.mocked(AskAIService.ask).mockResolvedValue({
      mode: 'answer',
      reply: '2 students are absent today.',
      citations: ['attendance'],
      pendingAction: null,
    });

    render(
      <MemoryRouter>
        <AskAIPage user={{ role: 'ADMIN', username: 'RAD' } as any} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Ask AI prompt/i), {
      target: { value: 'Who is absent today?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send prompt/i }));

    expect(await screen.findByText(/2 students are absent today/i)).toBeInTheDocument();
  });

  it('shows a confirmation card for add-points actions', async () => {
    vi.mocked(AskAIService.ask).mockResolvedValue({
      mode: 'confirm',
      reply: 'Add 5 points to Joshua for memory verse?',
      citations: ['students', 'points'],
      pendingAction: {
        type: 'add_points',
        studentId: 'student-1',
        studentName: 'Joshua',
        points: 5,
        category: 'Memory Verse',
        notes: 'AI drafted action',
      },
    });

    render(
      <MemoryRouter>
        <AskAIPage user={{ role: 'ADMIN', username: 'RAD' } as any} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Ask AI prompt/i), {
      target: { value: 'Add 5 points to Joshua for memory verse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send prompt/i }));

    expect(await screen.findByText(/Add 5 points to Joshua for memory verse\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Save/i })).toBeInTheDocument();
  });

  it('executes the confirmed add-points action', async () => {
    vi.mocked(AskAIService.ask).mockResolvedValue({
      mode: 'confirm',
      reply: 'Add 5 points to Joshua for memory verse?',
      citations: [],
      pendingAction: {
        type: 'add_points',
        studentId: 'student-1',
        studentName: 'Joshua',
        points: 5,
        category: 'Memory Verse',
        notes: 'AI drafted action',
      },
    });
    vi.mocked(AskAIService.executeAddPoints).mockResolvedValue({ id: 'entry-1' } as any);

    render(
      <MemoryRouter>
        <AskAIPage user={{ role: 'ADMIN', username: 'RAD' } as any} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Ask AI prompt/i), {
      target: { value: 'Add 5 points to Joshua for memory verse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send prompt/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirm Save/i }));

    await waitFor(() => {
      expect(AskAIService.executeAddPoints).toHaveBeenCalledWith({
        type: 'add_points',
        studentId: 'student-1',
        studentName: 'Joshua',
        points: 5,
        category: 'Memory Verse',
        notes: 'AI drafted action',
        actor: {
          role: 'ADMIN',
          username: 'RAD',
          isReadOnly: undefined,
        },
      });
    });
  });

  it('shows read-only guidance when teacher access is read-only', () => {
    render(
      <MemoryRouter>
        <AskAIPage user={{ role: 'TEACHER', username: 'JOY', isReadOnly: true } as any} />
      </MemoryRouter>
    );

    expect(screen.getByText(/read-only mode/i)).toBeInTheDocument();
  });

  it('clears the prompt and conversation when clear chat is pressed', async () => {
    vi.mocked(AskAIService.ask).mockResolvedValue({
      mode: 'answer',
      reply: '2 students are absent today.',
      citations: ['attendance'],
      pendingAction: null,
    });

    render(
      <MemoryRouter>
        <AskAIPage user={{ role: 'ADMIN', username: 'RAD' } as any} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Ask AI prompt/i), {
      target: { value: 'Who is absent today?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send prompt/i }));

    expect(await screen.findByText(/2 students are absent today/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Clear Chat/i }));

    expect(screen.getByLabelText(/Ask AI prompt/i)).toHaveValue('');
    expect(screen.queryByText(/2 students are absent today/i)).not.toBeInTheDocument();
    expect(screen.getByText(/How To Use Me/i)).toBeInTheDocument();
  });
});
