import React, { useMemo, useState } from 'react';
import { Loader2, Mic, Plus, Shield, Sparkles, Square } from 'lucide-react';
import type { UserSession } from '../types';
import type { AskAIResponse } from '../services/ask-ai.types';
import { AskAIService } from '../services/ask-ai.service';
import { audio } from '../services/audio.service';

const toDisplayName = (username?: string) => {
  if (!username) return 'Friend';
  return username
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const AskAIPage: React.FC<{ user: UserSession | null }> = ({ user }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<AskAIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const displayName = useMemo(() => toDisplayName(user?.username), [user?.username]);

  const canWrite = useMemo(
    () => Boolean(user && !user.isReadOnly && (user.role === 'ADMIN' || user.role === 'TEACHER')),
    [user]
  );

  const handleAsk = async () => {
    if (!prompt.trim() || !user || isLoading) return;
    audio.playClick();
    setIsLoading(true);
    try {
      const next = await AskAIService.ask({
        prompt,
        actor: {
          role: user.role,
          username: user.username,
          isReadOnly: user.isReadOnly,
        },
      });
      setResponse(next);
    } catch (error) {
      setResponse({
        mode: 'error',
        reply: error instanceof Error ? error.message : 'Ask AI is unavailable right now.',
        citations: [],
        pendingAction: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!response?.pendingAction || !user || isLoading) return;
    if (!canWrite) {
      setResponse({
        mode: 'error',
        reply: 'This session is read-only. Ask AI can answer questions, but cannot save changes.',
        citations: [],
        pendingAction: null,
      });
      return;
    }

    audio.playClick();
    setIsLoading(true);
    try {
      await AskAIService.executeAddPoints({
        ...response.pendingAction,
        actor: user.username,
      });
      audio.playYehey();
      setResponse({
        mode: 'answer',
        reply: `Points added successfully for ${response.pendingAction.studentName}.`,
        citations: ['points'],
        pendingAction: null,
      });
      setPrompt('');
    } catch (error) {
      setResponse({
        mode: 'error',
        reply: error instanceof Error ? error.message : 'Unable to save the Ask AI action.',
        citations: ['points'],
        pendingAction: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    audio.playClick();
    setPrompt('');
    setResponse(null);
    setIsLoading(false);
  };

  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-10rem)] min-h-[620px] flex flex-col bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 md:px-12 pt-10 md:pt-14 text-center shrink-0 relative">
        {(prompt || response) && (
          <button
            type="button"
            onClick={handleClearChat}
            className="absolute right-6 top-10 md:right-12 md:top-14 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#F97316] transition-colors"
          >
            Clear Chat
          </button>
        )}
        <h1 className="text-3xl md:text-5xl font-medium tracking-tight text-gray-900">
          How can I help, {displayName}?
        </h1>
      </div>

      {!canWrite && (
        <div className="mx-6 md:mx-10 mt-6 bg-amber-50 border border-amber-100 p-4 rounded-[1.75rem] shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Read-only mode</p>
          <p className="mt-2 text-sm text-amber-900">
            Ask AI can answer questions, but write actions are disabled for this session.
          </p>
        </div>
      )}

      <div className="flex-1 px-6 md:px-10 py-8 overflow-y-auto">
        {!response ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-sm md:text-base text-gray-400 max-w-xl">
              Ask about attendance, students, follow-up, leaderboard, or draft a points action for confirmation.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-end">
              <div className="max-w-[70%] rounded-[1.5rem] bg-[#FCE7DA] px-5 py-3 text-sm text-[#7A3D14] shadow-sm">
                {prompt}
              </div>
            </div>

            <div className="max-w-3xl space-y-4">
              <p className="text-2xl text-gray-950 whitespace-pre-wrap">{response.reply}</p>

              {response.citations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {response.citations.map((citation) => (
                    <span
                      key={citation}
                      className="px-3 py-1 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400"
                    >
                      {citation}
                    </span>
                  ))}
                </div>
              )}

              {response.mode === 'confirm' && response.pendingAction && (
                <div className="max-w-xl rounded-[1.75rem] border border-[#F5D2BF] bg-[#FFF4EC] p-5 space-y-4">
                  <div className="flex items-center gap-2 text-[#B85B1B]">
                    <Shield size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Needs confirmation</span>
                  </div>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p>Student: {response.pendingAction.studentName}</p>
                    <p>Points: +{response.pendingAction.points}</p>
                    <p>Category: {response.pendingAction.category}</p>
                  </div>
                  <button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    className="px-5 py-3 rounded-2xl bg-[#F97316] text-white font-black uppercase text-[10px] tracking-widest hover:bg-[#EA580C] disabled:opacity-50"
                  >
                    Confirm Save
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6 shrink-0">
        <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-50 transition-colors shrink-0"
            aria-label="Add attachment"
          >
            <Plus size={20} />
          </button>

          <input
            type="text"
            className="flex-1 border-none outline-none bg-transparent text-base text-gray-800 placeholder:text-gray-400"
            placeholder="Ask anything"
            aria-label="Ask AI prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAsk();
              }
            }}
          />

          <button
            type="button"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-50 transition-colors shrink-0"
            aria-label="Voice input"
          >
            <Mic size={18} />
          </button>

          <button
            onClick={isLoading ? undefined : handleAsk}
            disabled={!prompt.trim()}
            className="w-11 h-11 rounded-full bg-[#F97316] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#EA580C] transition-colors shrink-0"
            aria-label={isLoading ? 'Stop response' : 'Send prompt'}
          >
            {isLoading ? <Square size={16} fill="currentColor" /> : <Sparkles size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AskAIPage;
