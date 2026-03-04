
import React, { useState, useEffect, useMemo } from 'react';
import { MinistryService, LeaderboardEntry } from '../services/ministry.service';
import { db, formatError } from '../services/db.service';
import { AgeGroup, UserSession, Student } from '../types';
import { audio } from '../services/audio.service';
import { StudentAnalyticsModal } from '../components/StudentAnalyticsModal';
import { safeJsonParse } from '../utils/storage';

const LeaderboardPage: React.FC = () => {
  const [overall, setOverall] = useState<LeaderboardEntry[]>([]);
  const [monthly, setMonthly] = useState<LeaderboardEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [ageFilter, setAgeFilter] = useState<AgeGroup | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [categoryOptions, setCategoryOptions] = useState<string[]>(['Attendance', 'Worksheet', 'Memory Verse', 'Recitation', 'Presentation']);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedRank, setSelectedRank] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sessionStr = sessionStorage.getItem('km_session');
  const user = safeJsonParse<UserSession | null>(sessionStr, null);
  const isAdmin = user?.role === 'ADMIN';

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear, ageFilter, categoryFilter]);

  const loadData = async () => {
    setLoading(true);
    setUsingMockData(false);
    try {
      const ledger = await db.getPointsLedger();
      const categories = Array.from(new Set(ledger.filter(l => !l.voided).map(l => l.category).filter(Boolean))).sort();
      if (categories.length > 0) setCategoryOptions(categories);

      const selectedCategory = categoryFilter === 'ALL' ? undefined : categoryFilter;
      const ov = await MinistryService.getLeaderboard(ageFilter === 'ALL' ? undefined : ageFilter, undefined, selectedCategory);
      const mon = await MinistryService.getMonthlyLeaderboard(selectedMonth, selectedYear, ageFilter === 'ALL' ? undefined : ageFilter, selectedCategory);

      setOverall(ov.filter(k => k.totalPoints > 0));
      setMonthly(mon.filter(k => k.totalPoints > 0));
    } catch (e) {
      console.error("Supabase connection failed, using mock data:", e);
      setUsingMockData(true);

      // MOCK DATA FALLBACK (Prevents Crash)
      const mockStudents: any[] = [
        { id: '1', fullName: 'ALEXA G.', ageGroup: '10-12', totalPoints: 1250 },
        { id: '2', fullName: 'LIAM P.', ageGroup: '7-9', totalPoints: 980 },
        { id: '3', fullName: 'ZARA M.', ageGroup: '3-6', totalPoints: 850 },
        { id: '4', fullName: 'NOAH E.', ageGroup: '3-6', totalPoints: 720 },
        { id: '5', fullName: 'MIA S.', ageGroup: '10-12', totalPoints: 690 },
      ];
      setOverall(mockStudents);
      setMonthly(mockStudents.slice(0, 3).map(s => ({ ...s, totalPoints: Math.floor(s.totalPoints / 10) })));
    } finally {
      setLoading(false);
    }
  };

  const handleResetMonthly = async () => {
    if (!isAdmin) return;
    audio.playClick();

    const confirmMsg = `⚠️ ADMIN: Reset monthly points for ${months[selectedMonth]} ${selectedYear}?\n\nThis will DELETE all stars earned in this month for ALL students.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0);

      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      await db.runRawSql(`DELETE FROM point_ledger WHERE entry_date >= '${startStr}' AND entry_date <= '${endStr}'`);

      await db.log({
        eventType: 'AUDIT_WIPE',
        actor: user?.username || 'ADMIN',
        payload: { action: 'RESET_MONTHLY_POINTS', month: selectedMonth, year: selectedYear }
      });

      alert(`Points for ${months[selectedMonth]} have been reset to 0.`);
      loadData(); // Reload
    } catch (e) {
      alert("Reset failed: " + formatError(e));
      setLoading(false);
    }
  };

  const classSections = [
    { key: '3-6' as AgeGroup, label: '3-6 Years' },
    { key: '7-9' as AgeGroup, label: '7-9 Years' },
    { key: '10-12' as AgeGroup, label: '10-12 Years' }
  ];

  const overallByClass = useMemo(() => {
    return classSections.map(section => ({
      ...section,
      entries: overall.filter(k => k.ageGroup === section.key).slice(0, 10)
    }));
  }, [overall]);

  const monthlyByClass = useMemo(() => {
    return classSections.map(section => ({
      ...section,
      entries: monthly.filter(k => k.ageGroup === section.key).slice(0, 5)
    }));
  }, [monthly]);

  const singleOverall = useMemo(() => overall.slice(0, 10), [overall]);
  const singleMonthly = useMemo(() => monthly.slice(0, 5), [monthly]);

  const maxPointsOverall = singleOverall.length > 0 ? singleOverall[0].totalPoints : 1;

  const handleStudentClick = (student: LeaderboardEntry, rank: number) => {
    // Convert LeaderboardEntry to Student type
    const studentData: Student = {
      id: student.id,
      accessKey: student.accessKey,
      fullName: student.fullName,
      birthday: student.birthday,
      ageGroup: student.ageGroup,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      photoUrl: student.photoUrl,
      isEnrolled: student.isEnrolled,
      notes: student.notes,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      consecutiveAbsences: student.consecutiveAbsences,
      studentStatus: student.studentStatus,
      lastFollowupSent: student.lastFollowupSent,
      guardianNickname: student.guardianNickname,
      currentRole: student.currentRole,
      batchYear: student.batchYear,
      isLegacy: student.isLegacy
    };
    setSelectedStudent(studentData);
    setSelectedRank(rank);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
    setSelectedRank(0);
  };

  if (loading) return <div className="p-10 text-center uppercase font-black text-pink-300 animate-pulse">Ranking the Kids...</div>;

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-3xl font-black text-gray-800 uppercase tracking-tighter">Leaderboard</h2>
            {usingMockData && (
              <span className="bg-amber-100 text-amber-600 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-amber-200">
                Offline Mode
              </span>
            )}
          </div>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Friendly Competition & Rewards</p>
        </div>

        <div className="flex gap-4">
          <select
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value as any)}
            className="flex-1 md:flex-none px-6 py-3 bg-white border border-pink-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-200 text-xs font-black tracking-widest uppercase shadow-sm cursor-pointer"
          >
            <option value="ALL">All Age Groups</option>
            <option value="3-6">3-6 Years</option>
            <option value="7-9">7-9 Years</option>
            <option value="10-12">10-12 Years</option>
            <option value="General">General Group</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 md:flex-none px-6 py-3 bg-white border border-pink-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-200 text-xs font-black tracking-widest uppercase shadow-sm cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
        {/* Left Column: Overall Top 10 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
              <span className="text-xl">🏆</span> {ageFilter === 'ALL' ? 'Overall Rank Per Class' : 'Overall Top 10'}
            </h3>
            <span className="px-3 py-1 bg-pink-50 text-pink-500 text-[10px] font-black rounded-full uppercase">{categoryFilter === 'ALL' ? 'All-time' : categoryFilter}</span>
          </div>

          <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-pink-50 overflow-hidden p-6 md:p-8 space-y-6">
            {ageFilter === 'ALL' ? (
              <div className="space-y-8">
                {overallByClass.map((section) => {
                  const maxPerClass = section.entries.length > 0 ? section.entries[0].totalPoints : 1;
                  return (
                    <div key={section.key} className="space-y-4">
                      <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest">{section.label}</p>
                      {section.entries.length === 0 ? (
                        <div className="py-6 text-center text-gray-300 uppercase font-black text-[10px] tracking-widest italic">
                          No participants yet
                        </div>
                      ) : (
                        section.entries.map((kid, i) => (
                          <div
                            key={kid.id}
                            className="group relative cursor-pointer"
                            onClick={() => handleStudentClick(kid, i + 1)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-4">
                                <span className={`w-6 md:w-8 font-black text-sm ${i < 3 ? 'text-pink-500' : 'text-gray-300'}`}>
                                  #{i + 1}
                                </span>
                                <button
                                  className="font-black text-gray-800 uppercase tracking-tight text-xs truncate max-w-[120px] md:max-w-none hover:text-pink-500 transition-colors text-left"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStudentClick(kid, i + 1);
                                  }}
                                >
                                  {kid.fullName}
                                </button>
                                <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[8px] font-black rounded uppercase">
                                  {kid.ageGroup}
                                </span>
                              </div>
                              <span className="font-black text-gray-800 text-sm shrink-0">
                                {kid.totalPoints} <span className="text-[9px] text-pink-400 uppercase">pts</span>
                              </span>
                            </div>
                            <div className="w-full bg-gray-50 h-3 rounded-full overflow-hidden border border-gray-100 shadow-inner">
                              <div
                                className="h-full bg-gradient-to-r from-pink-400 to-pink-600 transition-all duration-1000 ease-out relative"
                                style={{ width: `${(kid.totalPoints / maxPerClass) * 100}%` }}
                              >
                                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {singleOverall.map((kid, i) => (
                  <div
                    key={kid.id}
                    className="group relative cursor-pointer"
                    onClick={() => handleStudentClick(kid, i + 1)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <span className={`w-6 md:w-8 font-black text-sm ${i < 3 ? 'text-pink-500' : 'text-gray-300'}`}>
                          #{i + 1}
                        </span>
                        <button
                          className="font-black text-gray-800 uppercase tracking-tight text-xs truncate max-w-[120px] md:max-w-none hover:text-pink-500 transition-colors text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStudentClick(kid, i + 1);
                          }}
                        >
                          {kid.fullName}
                        </button>
                        <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[8px] font-black rounded uppercase">
                          {kid.ageGroup}
                        </span>
                      </div>
                      <span className="font-black text-gray-800 text-sm shrink-0">
                        {kid.totalPoints} <span className="text-[9px] text-pink-400 uppercase">pts</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-50 h-3 rounded-full overflow-hidden border border-gray-100 shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-pink-400 to-pink-600 transition-all duration-1000 ease-out relative"
                        style={{ width: `${(kid.totalPoints / maxPointsOverall) * 100}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                ))}
                {singleOverall.length === 0 && (
                  <div className="py-20 text-center text-gray-300 uppercase font-black text-xs tracking-widest italic">
                    No participants with points yet
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Monthly Top 5 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
              <span className="text-xl">📅</span> {ageFilter === 'ALL' ? 'Top 5 This Month Per Class' : 'Top 5 This Month'}
            </h3>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-gray-50 border-none outline-none text-[10px] font-black text-pink-500 uppercase tracking-widest px-3 py-1 rounded-full cursor-pointer hover:bg-pink-50"
              >
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-pink-50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[9px] font-bold text-pink-400 uppercase tracking-widest border-b border-pink-50">
                    <th className="px-6 md:px-8 py-5">Rank</th>
                    <th className="px-6 md:px-8 py-5">Student</th>
                    <th className="px-6 md:px-8 py-5 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-50/50">
                  {ageFilter === 'ALL' ? (
                    monthlyByClass.map((section) => (
                      <React.Fragment key={section.key}>
                        <tr>
                          <td colSpan={3} className="px-6 md:px-8 py-3 bg-pink-50/40 text-[10px] font-black text-pink-500 uppercase tracking-widest">
                            {section.label}
                          </td>
                        </tr>
                        {section.entries.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-8 py-6 text-center text-gray-300 uppercase font-black text-[10px] tracking-widest">
                              No points this month
                            </td>
                          </tr>
                        ) : (
                          section.entries.map((kid, i) => (
                            <tr key={`${section.key}-${kid.id}`} className="hover:bg-pink-50/20 transition-all group">
                              <td className="px-6 md:px-8 py-6">
                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border-2 ${i === 0 ? 'bg-amber-400 border-amber-300 text-white shadow-lg shadow-amber-100' :
                                    i === 1 ? 'bg-gray-300 border-gray-200 text-white shadow-lg' :
                                      i === 2 ? 'bg-orange-300 border-orange-200 text-white shadow-lg' :
                                        'bg-white border-pink-50 text-pink-500'
                                  }`}>
                                  {i + 1}
                                </span>
                              </td>
                              <td className="px-6 md:px-8 py-6">
                                <div className="flex flex-col">
                                  <span className="font-black text-gray-800 uppercase tracking-tight text-xs truncate max-w-[100px] md:max-w-none">{kid.fullName}</span>
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{kid.ageGroup} Group</span>
                                </div>
                              </td>
                              <td className="px-6 md:px-8 py-6 text-right">
                                <span className="font-black text-gray-800 text-sm">{kid.totalPoints}</span>
                              </td>
                            </tr>
                          ))
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <>
                      {singleMonthly.map((kid, i) => (
                        <tr key={kid.id} className="hover:bg-pink-50/20 transition-all group">
                          <td className="px-6 md:px-8 py-6">
                            <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border-2 ${i === 0 ? 'bg-amber-400 border-amber-300 text-white shadow-lg shadow-amber-100' :
                                i === 1 ? 'bg-gray-300 border-gray-200 text-white shadow-lg' :
                                  i === 2 ? 'bg-orange-300 border-orange-200 text-white shadow-lg' :
                                    'bg-white border-pink-50 text-pink-500'
                              }`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-6 md:px-8 py-6">
                            <div className="flex flex-col">
                              <span className="font-black text-gray-800 uppercase tracking-tight text-xs truncate max-w-[100px] md:max-w-none">{kid.fullName}</span>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{kid.ageGroup} Group</span>
                            </div>
                          </td>
                          <td className="px-6 md:px-8 py-6 text-right">
                            <span className="font-black text-gray-800 text-sm">{kid.totalPoints}</span>
                          </td>
                        </tr>
                      ))}
                      {singleMonthly.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-8 py-20 text-center text-gray-300 uppercase font-black text-[10px] tracking-widest">
                            No {categoryFilter === 'ALL' ? '' : `${categoryFilter} `}points earned in {months[selectedMonth]} {selectedYear}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly Achievement Banner */}
          <div className="bg-gradient-to-br from-pink-500 to-rose-400 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden shadow-xl shadow-pink-100">
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="text-3xl md:text-4xl mb-4">🎖️</span>
              <h4 className="text-base md:text-lg font-black uppercase tracking-widest mb-2">Monthly Achievement</h4>
              <p className="text-[10px] md:text-xs text-pink-100 font-bold uppercase tracking-widest leading-relaxed">
                The top student of {months[selectedMonth]} will receive a special Kingdom Kids badge!
              </p>
            </div>
            <div className="absolute -bottom-10 -right-10 text-9xl text-white/10 font-black rotate-12 pointer-events-none">BADGE</div>
          </div>
        </div>
      </div>

      {/* Admin Reset Button */}
      {isAdmin && (
        <div className="mt-12 text-center border-t border-pink-50 pt-8">
          <p className="text-[9px] text-gray-300 font-black uppercase tracking-widest mb-4">Admin Controls</p>
          <button
            onClick={handleResetMonthly}
            className="text-[9px] bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 px-4 py-2 rounded-full font-bold uppercase tracking-widest transition-all"
          >
            ⚠️ Reset Monthly Stats for {months[selectedMonth]}
          </button>
        </div>
      )}

      {/* Student Analytics Modal */}
      {selectedStudent && (
        <StudentAnalyticsModal
          student={selectedStudent}
          currentRank={selectedRank}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default LeaderboardPage;
