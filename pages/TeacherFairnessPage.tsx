
import React, { useState, useEffect, useMemo } from 'react';
import { db, formatError } from '../services/db.service';
import { AgeGroup, Student } from '../types';
import { audio } from '../services/audio.service';

const TeacherFairnessPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedGroup, setSelectedGroup] = useState<AgeGroup | 'ALL'>('ALL');

  // Data
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear, selectedGroup]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // 1. Calculate Date Range
      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];

      // 2. Fetch joined data
      const [pointsData, studentsData] = await Promise.all([
        db.getFairnessData(startDate, endDate),
        db.getStudents()
      ]);

      // 3. Filter raw data if needed (DB filters by date, we filter by group in memory for flexibility)
      let filteredPoints = pointsData;
      let filteredStudents = studentsData;

      if (selectedGroup !== 'ALL') {
        filteredPoints = pointsData.filter((p: any) => p.student?.ageGroup === selectedGroup);
        filteredStudents = studentsData.filter(s => s.ageGroup === selectedGroup);
      }

      setLedgerData(filteredPoints);
      setAllStudents(filteredStudents);

    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  // --- Feature 2: Teacher Activity Report ---
  const teacherStats = useMemo(() => {
    const stats: Record<string, { totalPoints: number; uniqueStudents: Set<string> }> = {};
    
    ledgerData.forEach((entry: any) => {
      const teacher = entry.recordedBy || 'Unknown';
      if (!stats[teacher]) {
        stats[teacher] = { totalPoints: 0, uniqueStudents: new Set() };
      }
      stats[teacher].totalPoints += entry.points;
      if (entry.student?.id) {
        stats[teacher].uniqueStudents.add(entry.student.id);
      }
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      totalPoints: data.totalPoints,
      uniqueCount: data.uniqueStudents.size
    })).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [ledgerData]);

  // --- Feature 3: Weakest Link Detector ---
  const studentStats = useMemo(() => {
    if (allStudents.length === 0) return { average: 0, weakLinks: [] };

    // 1. Calculate points for every student
    const scores = allStudents.map(student => {
      const studentPoints = ledgerData
        .filter((l: any) => l.student_id === student.id)
        .reduce((sum: number, curr: any) => sum + curr.points, 0);
      return { ...student, total: studentPoints };
    });

    // 2. Calculate Class Average
    const totalClassPoints = scores.reduce((sum, s) => sum + s.total, 0);
    const average = totalClassPoints / allStudents.length;

    // 3. Identify Weak Links (Significantly below average - e.g. < 50% of avg)
    // If average is 0, nobody is weak.
    if (average === 0) return { average: 0, weakLinks: [] };

    const threshold = average * 0.5; 
    const weakLinks = scores
      .filter(s => s.total <= threshold)
      .sort((a, b) => a.total - b.total); // Lowest first

    return { average, weakLinks };
  }, [allStudents, ledgerData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Fairness Monitor</h2>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Teacher Engagement & Student Support</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <select 
            value={selectedMonth}
            onChange={(e) => { audio.playClick(); setSelectedMonth(Number(e.target.value)); }}
            className="px-4 py-3 bg-white border border-pink-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-200 text-[10px] font-black tracking-widest uppercase shadow-sm cursor-pointer"
          >
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          
          <select 
            value={selectedYear}
            onChange={(e) => { audio.playClick(); setSelectedYear(Number(e.target.value)); }}
            className="px-4 py-3 bg-white border border-pink-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-200 text-[10px] font-black tracking-widest uppercase shadow-sm cursor-pointer"
          >
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>

          <select 
            value={selectedGroup}
            onChange={(e) => { audio.playClick(); setSelectedGroup(e.target.value as any); }}
            className="px-4 py-3 bg-white border border-pink-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-200 text-[10px] font-black tracking-widest uppercase shadow-sm cursor-pointer"
          >
            <option value="ALL">All Groups</option>
            <option value="3-6">3-6 Years</option>
            <option value="7-9">7-9 Years</option>
            <option value="10-12">10-12 Years</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center animate-pulse text-pink-300 font-black uppercase tracking-[0.2em] text-[10px]">
          Calculating Fairness Metrics...
        </div>
      ) : error ? (
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-red-600 font-black uppercase tracking-widest text-xs text-center">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Section 1: Teacher Activity */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest ml-1">Teacher Activity Report</h3>
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-pink-50 overflow-hidden">
               <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b border-pink-50">
                      <th className="px-6 py-4">Teacher</th>
                      <th className="px-6 py-4 text-center">Pts Given</th>
                      <th className="px-6 py-4 text-right">Unique Kids</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-50/50">
                    {teacherStats.map((t, i) => (
                      <tr key={t.name} className="hover:bg-pink-50/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-pink-100 text-pink-500 rounded-lg flex items-center justify-center font-black text-[10px]">
                              {t.name[0]}
                            </div>
                            <span className="font-black text-gray-800 uppercase tracking-tight text-xs">{t.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-pink-50 text-pink-600 px-2 py-1 rounded-md text-[10px] font-black">
                            {t.totalPoints}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[10px] font-black text-gray-500">{t.uniqueCount}</span>
                        </td>
                      </tr>
                    ))}
                    {teacherStats.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-gray-300 font-black text-[10px] uppercase">
                          No activity recorded this month.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Weakest Link Detector */}
          <div className="space-y-4">
             <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Students Needing Attention</h3>
                <div className="flex items-center gap-2">
                   <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Class Avg:</span>
                   <span className="text-[10px] font-black text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{studentStats.average.toFixed(1)}</span>
                </div>
             </div>
             
             <div className="bg-white rounded-[2.5rem] shadow-sm border border-pink-50 overflow-hidden min-h-[200px]">
                {studentStats.weakLinks.length > 0 ? (
                  <div className="divide-y divide-pink-50/50">
                    {studentStats.weakLinks.map((s) => (
                      <div key={s.id} className="p-4 flex items-center justify-between hover:bg-yellow-50/50 transition-colors group">
                        <div className="flex items-center gap-3">
                           <span className="text-lg animate-pulse" title="Below Average Alert">⚠️</span>
                           <div>
                              <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{s.fullName}</p>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{s.ageGroup} Group</p>
                           </div>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className={`text-sm font-black ${s.total === 0 ? 'text-red-500' : 'text-orange-400'}`}>
                             {s.total} pts
                           </span>
                           <span className="text-[8px] font-bold text-gray-300 uppercase tracking-tighter">
                             {studentStats.average > 0 ? Math.round((s.total / studentStats.average) * 100) : 0}% of Avg
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-center p-6">
                     <span className="text-4xl mb-2 opacity-30">✨</span>
                     <p className="text-gray-300 font-black text-[10px] uppercase tracking-widest">
                       All students are doing well! <br/>No significant gaps detected.
                     </p>
                  </div>
                )}
             </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default TeacherFairnessPage;
