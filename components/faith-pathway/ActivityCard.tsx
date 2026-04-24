import React from 'react';
import { Download } from 'lucide-react';
import type { LessonActivity } from '../../types';

interface ActivityCardProps {
  activity: LessonActivity;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-[40px] p-8 md:p-10 shadow-sm hover:shadow-xl transition-all border-b-[12px] border-[#EF4E92]">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-2">
        <h3 className="text-2xl font-black text-[#003882] uppercase tracking-tight">{activity.title}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {activity.week_number != null && (
            <span className="bg-blue-50 text-[#003882] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
              Week {activity.week_number}
            </span>
          )}
          {activity.activity_type && (
            <span className="bg-purple-50 text-purple-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
              {activity.activity_type}
            </span>
          )}
          <span className="bg-pink-50 text-[#EF4E92] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
            {activity.duration_minutes} mins
          </span>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-4">Materials Required</h4>
          <div className="flex flex-wrap gap-2">
            {(activity.supplies ?? []).map((item, idx) => (
              <span key={idx} className="bg-slate-50 text-slate-700 px-4 py-2 rounded-2xl text-xs font-bold border border-slate-100">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-4">Step-by-Step Guide</h4>
          <div className="text-slate-700 text-lg leading-relaxed font-medium whitespace-pre-wrap">
            {activity.instructions}
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-slate-50 flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="text-[#EF4E92] hover:bg-pink-50 p-4 md:px-6 md:py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border border-transparent hover:border-pink-100 active:scale-90"
        >
          <Download size={20} strokeWidth={3} />
          <span className="hidden md:inline">Save as PDF</span>
        </button>
      </div>
    </div>
  );
};

export default ActivityCard;
