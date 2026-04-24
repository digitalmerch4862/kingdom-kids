/**
 * Admin UI for setting the featured lesson for any given week.
 * Used inside FaithPathwayAdminPage or as a standalone panel.
 */

import React, { useState, useEffect } from 'react';
import { Star, Calendar, ChevronDown } from 'lucide-react';
import {
  listLessons, listFeaturedLessons, setFeaturedLesson
} from '../../services/lessons.service';
import { formatWeekLabel, getMondayOf } from '../../utils/featuredWeek';
import type { Lesson, FeaturedLesson } from '../../types';

interface FeaturedLessonManagerProps {
  /** Actor name for `created_by` field. Defaults to 'admin'. */
  createdBy?: string;
}

const FeaturedLessonManager: React.FC<FeaturedLessonManagerProps> = ({ createdBy = 'admin' }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [featured, setFeatured] = useState<FeaturedLesson[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>(() => getMondayOf(new Date()));
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listLessons('PUBLISHED'), listFeaturedLessons(12)])
      .then(([ls, fs]) => { setLessons(ls); setFeatured(fs); })
      .catch(e => setError(e.message));
  }, []);

  // Pre-fill lesson if week already has a featured entry
  useEffect(() => {
    const existing = featured.find(f => f.week_start === selectedWeek);
    setSelectedLessonId(existing?.lesson_id ?? '');
  }, [selectedWeek, featured]);

  // Build week options — current week + next 3 + past 8
  const weekOptions: string[] = (() => {
    const weeks: string[] = [];
    const base = new Date(selectedWeek + 'T00:00:00Z');
    for (let i = -8; i <= 3; i++) {
      const d = new Date(base.getTime() + i * 7 * 86400_000);
      weeks.push(getMondayOf(d));
    }
    return [...new Set(weeks)].sort().reverse();
  })();

  const handleSave = async () => {
    if (!selectedLessonId) return setError('Select a lesson first.');
    setSaving(true); setError(null); setSuccess(null);
    try {
      const fl = await setFeaturedLesson(selectedLessonId, selectedWeek, createdBy);
      setFeatured(prev => {
        const idx = prev.findIndex(f => f.week_start === selectedWeek);
        if (idx >= 0) { const n = [...prev]; n[idx] = fl; return n; }
        return [...prev, fl];
      });
      setSuccess(`Featured lesson set for ${formatWeekLabel(selectedWeek)}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-[40px] border border-gray-100 p-8 md:p-10 shadow-sm space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center">
          <Star className="text-yellow-500" size={24} fill="currentColor" />
        </div>
        <div>
          <h3 className="font-black text-xl text-[#003882] uppercase tracking-tight">Featured Lesson Manager</h3>
          <p className="text-xs text-slate-400 font-medium">Set the lesson teachers see this week</p>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-2xl text-green-700 text-xs font-bold">{success}</div>}

      {/* Week picker */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Calendar size={12} /> Week
        </label>
        <div className="relative">
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-[#EF4E92] appearance-none cursor-pointer"
          >
            {weekOptions.map(w => (
              <option key={w} value={w}>
                {formatWeekLabel(w)}{featured.some(f => f.week_start === w) ? ' ★' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Lesson picker */}
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lesson</label>
        <div className="relative">
          <select
            value={selectedLessonId}
            onChange={e => setSelectedLessonId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:border-[#EF4E92] appearance-none cursor-pointer"
          >
            <option value="">— Select a published lesson —</option>
            {lessons.map(l => (
              <option key={l.id} value={l.id}>{l.title} ({l.category})</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !selectedLessonId}
        className="w-full bg-[#EF4E92] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-[#EF4E92]/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Star size={14} fill="currentColor" />}
        {saving ? 'Saving…' : 'Set Featured Lesson'}
      </button>

      {/* Recent featured */}
      {featured.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Recent Featured</p>
          {featured.slice(0, 5).map(f => (
            <div key={f.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">{formatWeekLabel(f.week_start)}</span>
              <span className="text-slate-400 truncate max-w-[160px]">{f.lesson?.title ?? f.lesson_id.slice(0, 8)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeaturedLessonManager;
