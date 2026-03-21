
import React, { useEffect, useState } from 'react';
import { X, TrendingUp, Award, Calendar, Activity } from 'lucide-react';
import { db } from '../services/db.service';
import { Student, PointLedger } from '../types';

interface StudentAnalyticsModalProps {
  student: Student;
  currentRank: number;
  isOpen: boolean;
  onClose: () => void;
}

interface DailyPoints {
  date: string;
  points: number;
  formattedDate: string;
}

interface CategoryBreakdown {
  category: string;
  points: number;
  color: string;
}

interface StudentAnalyticsData {
  dailyPoints: DailyPoints[];
  categoryBreakdown: CategoryBreakdown[];
  recentActivity: PointLedger[];
  totalPoints: number;
  monthlyTrend: Array<{ label: string; points: number }>;
  sundayScores: Array<{ label: string; points: number }>;
  monthlyScores: Array<{ label: string; points: number }>;
  quarterlyScores: Array<{ label: string; points: number }>;
  yearlyScores: Array<{ label: string; points: number }>;
}

// Category colors matching the app's pink theme
const CATEGORY_COLORS: Record<string, string> = {
  'Attendance': '#ec4899', // pink-500
  'Memory Verse': '#8b5cf6', // violet-500
  'Worksheet / Activities': '#f59e0b', // amber-500
  'Recitation': '#10b981', // emerald-500
  'Presentation': '#3b82f6', // blue-500
  'Manual Points': '#f97316', // orange-500
};

const getCategoryColor = (category: string): string => {
  return CATEGORY_COLORS[category] || '#ec4899';
};

const toLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const getQuarter = (monthIndex: number) => Math.floor(monthIndex / 3) + 1;

const toSundayOfWeek = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d;
};

const formatIsoDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const StudentAnalyticsModal: React.FC<StudentAnalyticsModalProps> = ({
  student,
  currentRank,
  isOpen,
  onClose
}) => {
  const [data, setData] = useState<StudentAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && student) {
      fetchAnalyticsData();
    }
  }, [isOpen, student]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch 30-day daily points
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      // Fetch category breakdown
      const categoryData = await db.getStudentCategoryBreakdown(student.id);
      
      // Fetch recent activity (last 5 entries)
      const recentActivity = await db.getStudentLedger(student.id, 5);

      // Fetch all ledger entries for period analytics
      const allLedger = await db.getPointsLedger();
      const studentLedger = allLedger
        .filter((l) => l.studentId === student.id && !l.voided)
        .sort((a, b) => a.entryDate.localeCompare(b.entryDate));

      const sundayMap = new Map<string, number>();
      const monthMap = new Map<string, number>();
      const quarterMap = new Map<string, number>();
      const yearMap = new Map<string, number>();

      studentLedger.forEach((entry) => {
        const d = toLocalDate(entry.entryDate);
        const sunday = toSundayOfWeek(d);
        const sundayKey = formatIsoDate(sunday);
        const sundayLabel = sunday.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const quarterLabel = `Q${getQuarter(d.getMonth())} ${d.getFullYear()}`;
        const yearLabel = String(d.getFullYear());

        sundayMap.set(sundayKey, (sundayMap.get(sundayKey) || 0) + entry.points);
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + entry.points);
        quarterMap.set(quarterLabel, (quarterMap.get(quarterLabel) || 0) + entry.points);
        yearMap.set(yearLabel, (yearMap.get(yearLabel) || 0) + entry.points);
      });

      // Calculate total points
      const totalPoints = categoryData.reduce((sum: number, cat: CategoryBreakdown) => sum + cat.points, 0);

      const sundayScores = Array.from(sundayMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([iso, points]) => {
          const d = toLocalDate(iso);
          return {
            date: iso,
            label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            points
          };
        });
      const sundayScoresLast30 = sundayScores.filter(s => s.date >= startDate && s.date <= endDate);
      const monthlyTrend = Array.from(monthMap.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([monthKey, points]) => {
          const d = toLocalDate(`${monthKey}-01`);
          return {
            label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            points
          };
        });

      setData({
        // Show weekly Sunday trend so mass weekly uploads are visible as weekly totals.
        dailyPoints: sundayScoresLast30.map(s => ({ date: s.date, formattedDate: s.label, points: s.points })),
        categoryBreakdown: categoryData,
        recentActivity,
        totalPoints,
        monthlyTrend,
        sundayScores: sundayScores.map(({ label, points }) => ({ label, points })),
        monthlyScores: monthlyTrend,
        quarterlyScores: Array.from(quarterMap, ([label, points]) => ({ label, points })).reverse(),
        yearlyScores: Array.from(yearMap, ([label, points]) => ({ label, points })).reverse()
      });
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-6 md:p-8 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-full flex items-center justify-center text-3xl md:text-4xl font-black">
              {student.fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight truncate">
                {student.fullName}
              </h2>
              <div className="flex items-center gap-3 mt-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
                  Rank #{currentRank}
                </span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
                  {student.ageGroup}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-gray-400">
              <p className="font-bold uppercase tracking-widest text-sm">{error}</p>
              <button 
                onClick={fetchAnalyticsData}
                className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-full text-xs font-bold uppercase tracking-wider hover:bg-pink-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              {/* Total Points Card */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-pink-50 rounded-2xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-pink-500 mb-1">
                    <Award size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Total Points</span>
                  </div>
                  <div className="text-3xl md:text-4xl font-black text-gray-800">
                    {data.totalPoints.toLocaleString()}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-2xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-purple-500 mb-1">
                    <Calendar size={18} />
                    <span className="text-xs font-black uppercase tracking-widest">Last 30 Days</span>
                  </div>
                  <div className="text-3xl md:text-4xl font-black text-gray-800">
                    {data.dailyPoints.reduce((sum, d) => sum + d.points, 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Trend Chart */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={18} className="text-pink-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-800">
                    Monthly Growth Trend
                  </h3>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 md:p-6">
                  <MonthlyBarChart data={data.monthlyTrend} />
                </div>
              </div>

              {/* Period Analytics */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={18} className="text-pink-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-800">
                    Score by Sunday / Month / Quarter / Year
                  </h3>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <PeriodScoreCard title="Per Sunday" rows={data.sundayScores} />
                  <PeriodScoreCard title="Per Month" rows={data.monthlyScores} />
                  <PeriodScoreCard title="Per Quarter" rows={data.quarterlyScores} />
                  <PeriodScoreCard title="Per Year" rows={data.yearlyScores} />
                </div>
              </div>

              {/* Category Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={18} className="text-pink-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-800">
                    Points by Category
                  </h3>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 md:p-6">
                  <CategoryBreakdownChart data={data.categoryBreakdown} />
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar size={18} className="text-pink-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-800">
                    Recent Activity
                  </h3>
                </div>
                <div className="space-y-3">
                  {data.recentActivity.length > 0 ? (
                    data.recentActivity.map((activity) => (
                      <div 
                        key={activity.id}
                        className="flex items-center justify-between p-4 bg-white border border-pink-50 rounded-2xl hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: getCategoryColor(activity.category) }}
                          >
                            {activity.category.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-sm uppercase tracking-tight">
                              {activity.category}
                            </p>
                            <p className="text-xs text-gray-400 font-medium">
                              {new Date(activity.entryDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-black text-lg ${activity.points >= 0 ? 'text-pink-500' : 'text-red-500'}`}>
                            {activity.points > 0 ? '+' : ''}{activity.points}
                          </span>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">pts</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-xs font-black uppercase tracking-widest">No recent activity</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const MonthlyBarChart: React.FC<{ data: Array<{ label: string; points: number }> }> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400">
        <p className="text-xs font-black uppercase tracking-widest">No data available</p>
      </div>
    );
  }

  const maxPoints = Math.max(...data.map(d => d.points), 1);
  return (
    <div className="space-y-3">
      {data.map((row) => {
        const width = Math.max(4, (row.points / maxPoints) * 100);
        return (
          <div key={row.label} className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-gray-500">
              <span>{row.label}</span>
              <span className="text-pink-500">{row.points}</span>
            </div>
            <div className="h-2 rounded-full bg-white border border-pink-100 overflow-hidden">
              <div className="h-full bg-pink-500 rounded-full" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Category Breakdown Component with Progress Bars
const CategoryBreakdownChart: React.FC<{ data: CategoryBreakdown[] }> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-400">
        <p className="text-xs font-black uppercase tracking-widest">No category data</p>
      </div>
    );
  }

  const total = data.reduce((sum, cat) => sum + cat.points, 0);
  const sortedData = [...data].sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-4">
      {sortedData.map((category) => {
        const percentage = total > 0 ? (category.points / total) * 100 : 0;
        return (
          <div key={category.category} className="group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-tight">
                  {category.category}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-gray-800">
                  {category.points.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-gray-400">
                  {percentage.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-80"
                style={{ 
                  width: `${percentage}%`,
                  backgroundColor: category.color
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StudentAnalyticsModal;

const PeriodScoreCard: React.FC<{ title: string; rows: Array<{ label: string; points: number }> }> = ({ title, rows }) => {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 border border-pink-50">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-700 mb-3">{title}</h4>
      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
        {rows.length > 0 ? rows.map((row) => (
          <div key={`${title}-${row.label}`} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-pink-50">
            <span className="text-[11px] font-bold text-gray-700 uppercase">{row.label}</span>
            <span className="text-[12px] font-black text-pink-500">{row.points}</span>
          </div>
        )) : (
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 py-3 text-center">
            No data
          </div>
        )}
      </div>
    </div>
  );
};
