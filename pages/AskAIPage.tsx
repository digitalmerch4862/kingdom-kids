import React, { useMemo, useState } from 'react';
import { Bot, Loader2, MessageSquare, Shield, Sparkles } from 'lucide-react';
import type { UserSession } from '../types';
import type { AskAIResponse } from '../services/ask-ai.types';
import { AskAIService } from '../services/ask-ai.service';
import { audio } from '../services/audio.service';

const AskAIPage: React.FC<{ user: UserSession | null }> = ({ user }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<AskAIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <section className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-pink-50 shadow-sm overflow-hidden relative">
        <div className="absolute right-8 top-6 text-pink-100 hidden md:block">
          <Bot size={84} strokeWidth={1.5} />
        </div>
        <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Kingdom Kids AI</p>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-gray-900 mt-2">Ask AI</h1>
        <p className="text-sm text-gray-500 mt-3 max-w-2xl">
          Ask about attendance, students, follow-up, leaderboard, and points. Point changes are previewed first and only saved after confirmation.
        </p>
      </section>

      {!canWrite && (
        <div className="bg-amber-50 border border-amber-100 p-5 rounded-[2rem]">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Read-only mode</p>
          <p className="mt-2 text-sm text-amber-900">
            Ask AI can answer questions, but write actions are disabled for this session.
          </p>
        </div>
      )}

      <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-pink-50 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center">
            <MessageSquare size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Prompt</p>
            <p className="text-sm font-black text-gray-800 uppercase tracking-tight">Staff command box</p>
          </div>
        </div>

        <textarea
          className="w-full min-h-[160px] rounded-[1.75rem] border border-gray-200 p-5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-pink-200 resize-none"
          placeholder="Ask about students, attendance, points, or follow-up..."
          aria-label="Ask AI prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Signed in as {user?.username ?? 'Unknown'}
          </div>
          <button
            onClick={handleAsk}
            disabled={!prompt.trim() || isLoading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-pink-500 text-white font-black uppercase text-[10px] tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-600 transition-colors"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Ask AI
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.5rem] border border-pink-50 bg-pink-50/40 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-pink-400">Examples</p>
            <p className="mt-2 text-xs text-gray-600">Who is absent today?</p>
          </div>
          <div className="rounded-[1.5rem] border border-pink-50 bg-pink-50/40 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-pink-400">Examples</p>
            <p className="mt-2 text-xs text-gray-600">Who needs follow-up?</p>
          </div>
          <div className="rounded-[1.5rem] border border-pink-50 bg-pink-50/40 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-pink-400">Examples</p>
            <p className="mt-2 text-xs text-gray-600">Add 5 points to Joshua for Memory Verse</p>
          </div>
        </div>
      </section>

      {response && (
        <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-pink-50 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Reply</p>
              <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{response.reply}</p>
            </div>
            {response.mode === 'confirm' && (
                <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl bg-pink-50 text-pink-500">
                <Shield size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Needs confirmation</span>
              </div>
            )}
          </div>

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
            <div className="bg-pink-50 border border-pink-100 p-5 rounded-[1.75rem] space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-pink-500">Pending write</p>
              <div className="text-sm text-gray-700 space-y-1">
                <p>Student: {response.pendingAction.studentName}</p>
                <p>Points: +{response.pendingAction.points}</p>
                <p>Category: {response.pendingAction.category}</p>
              </div>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="px-5 py-3 rounded-2xl bg-pink-500 text-white font-black uppercase text-[10px] tracking-widest hover:bg-pink-600 disabled:opacity-50"
              >
                Confirm Save
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AskAIPage;
