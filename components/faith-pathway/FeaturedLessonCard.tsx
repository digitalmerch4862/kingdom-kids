/**
 * Dashboard widget showing the featured lesson for the current week.
 * Rendered on the teacher home dashboard.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ChevronRight, BookOpen } from 'lucide-react';
import { getFeaturedLesson } from '../../services/lessons.service';
import { formatWeekLabel } from '../../utils/featuredWeek';
import type { FeaturedLesson } from '../../types';

const FeaturedLessonCard: React.FC = () => {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<FeaturedLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFeaturedLesson()
      .then(setFeatured)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-slate-100 rounded-full w-1/3 mb-3" />
        <div className="h-6 bg-slate-100 rounded-full w-2/3 mb-2" />
        <div className="h-3 bg-slate-100 rounded-full w-full" />
      </div>
    );
  }

  if (error || !featured) {
    return null; // silently hide if no featured lesson set
  }

  const lesson = featured.lesson;

  return (
    <div
      onClick={() => navigate('/faith-pathway')}
      className="bg-gradient-to-br from-[#003882] to-[#1a5fb4] rounded-[32px] p-6 md:p-8 shadow-xl cursor-pointer hover:shadow-2xl transition-all group relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#EF4E92]/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />

      {/* Label */}
      <div className="flex items-center gap-2 mb-4">
        <Star className="text-yellow-400" size={14} fill="currentColor" />
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/60">This Week's Featured Lesson</span>
      </div>

      {/* Week label */}
      <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-2">
        {formatWeekLabel(featured.week_start)}
      </p>

      {/* Lesson title */}
      <h3 className="text-xl md:text-2xl font-black text-white tracking-tight mb-2 group-hover:text-[#EF4E92] transition-colors">
        {lesson?.title ?? 'Untitled Lesson'}
      </h3>

      {/* Summary */}
      {lesson?.summary && (
        <p className="text-sm text-white/60 font-medium leading-relaxed line-clamp-2 mb-5">
          {lesson.summary}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/40">
          <BookOpen size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">{lesson?.category ?? ''}</span>
        </div>
        <div className="flex items-center gap-1 text-[#EF4E92] bg-white/10 rounded-full px-4 py-2 group-hover:bg-white/20 transition-all">
          <span className="text-[10px] font-black uppercase tracking-widest">Open</span>
          <ChevronRight size={14} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
};

export default FeaturedLessonCard;
