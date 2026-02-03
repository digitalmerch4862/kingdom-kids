import React, { useState, useEffect, useMemo } from 'react';
import { db, formatError } from '../services/db.service';
import { PointLedger, Student, UserSession, TeacherAssignmentRecord } from '../types';
import { audio } from '../services/audio.service';
import { AlertTriangle, Star, Users, ArrowLeft, Trophy } from 'lucide-react';

const PointsLedgerPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [viewMode, setViewMode] = useState<'LEDGER' | 'CLASSROOM'>(user.role === 'TEACHER' ? 'CLASSROOM' : 'LEDGER');

  // Ledger State
  const [ledger, setLedger] = useState<(PointLedger & { student?: Student })[]>([]);
  const [search, setSearch] = useState('');
  const [mobileTab, setMobileTab] = useState<'DATE' | 'STUDENT' | 'CATEGORY'>('DATE');

  // Classroom State
  const [assignedClass, setAssignedClass] = useState<{ name: string, students: Student[], date: string } | null>(null);
  const [dailyScores, setDailyScores] = useState<Record<string, number>>({});
  const [totalScores, setTotalScores] = useState<Record<string, number>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [loading, setLoading] = useState(true);
  const isAdmin = user.role === 'ADMIN';

  useEffect(() => {
    if (viewMode === 'LEDGER') {
      loadLedger();
    } else {
      loadClassroom();
    }
  }, [viewMode]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const allEntries = await db.getPointsLedger();
      const students = await db.getStudents();
      const enriched = allEntries.map(entry => ({
        ...entry,
        student: students.find(s => s.id === entry.studentId)
      }));
      setLedger(enriched);
    } catch (err) {
      console.error(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadClassroom = async () => {
    setLoading(true);
    try {
      // 1. Get Today's Assignment
      const today = new Date().toISOString().split('T')[0];
      const board = await db.getTeacherBoard();
      const todayAssignment = board.find(b => b.activity_date === today);

      // 2. Determine Assigned Class
      const userName = user.username.toUpperCase();
      let targetAgeGroup: string | null = null;
      let className = '';

      if (todayAssignment) {
        if ((todayAssignment.age_group_3_6 || '').toUpperCase().includes(userName)) {
          targetAgeGroup = '3-6';
          className = '3-6 YEARS OLD';
        } else if ((todayAssignment.age_group_7_9 || '').toUpperCase().includes(userName)) {
          targetAgeGroup = '7-9';
          className = '7-9 YEARS OLD';
        } else if ((todayAssignment.teens || '').toUpperCase().includes(userName)) {
          targetAgeGroup = '10-12';
          className = 'TEENS (10-12)';
        }
      }

      // Admin Override (5th Sunday Logic / Universal Access)
      if (!targetAgeGroup && isAdmin) {
        targetAgeGroup = 'ALL';
        className = '5th Sunday / Admin Mode';
      }

      if (!targetAgeGroup) {
        setAssignedClass(null);
        setLoading(false);
        return;
      }

      // 3. Get Students
      const allStudents = await db.getStudents();
      let classStudents: Student[] = [];

      if (targetAgeGroup === 'ALL') {
        classStudents = allStudents.filter(s => s.studentStatus === 'active');
      } else {
        classStudents = allStudents.filter(s => s.ageGroup === targetAgeGroup);
      }

      // 4. Get Scores
      const allLedger = await db.getPointsLedger();
      const dailyMap: Record<string, number> = {};
      const totalMap: Record<string, number> = {};

      allLedger.forEach(l => {
        if (l.voided) return;

        // Total Score
        totalMap[l.studentId] = (totalMap[l.studentId] || 0) + l.points;

        // Daily Score
        if (l.entryDate === today) {
          dailyMap[l.studentId] = (dailyMap[l.studentId] || 0) + l.points;
        }
      });

      // Sort by Total Score (Lowest to Highest as per request: "yung pinaka mababa pataas")
      classStudents.sort((a, b) => (totalMap[a.id] || 0) - (totalMap[b.id] || 0));

      setAssignedClass({
        name: className,
        students: classStudents,
        date: today
      });
      setDailyScores(dailyMap);
      setTotalScores(totalMap);

    } catch (err) {
      console.error(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGivePoints = async (category: string, points: number) => {
    if (!selectedStudent || !assignedClass) return;

    // Check Daily Limit (50)
    const currentDaily = dailyScores[selectedStudent.id] || 0;
    if (currentDaily + points > 50) {
      alert(`Daily limit reached! Student has ${currentDaily}/50 points today.`);
      return;
    }

    try {
      audio.playClick();
      await db.addPointEntry({
        studentId: selectedStudent.id,
        entryDate: assignedClass.date,
        category: category,
        points: points,
        notes: `Classroom Award: ${assignedClass.name}`,
        recordedBy: user.username
      });

      audio.playYehey();
      setSelectedStudent(null);
      loadClassroom(); // Reload to update scores and sorting
    } catch (err) {
      alert(formatError(err));
    }
  };

  const handleVoid = async (id: string) => {
    const reason = window.prompt("Enter reason for voiding these points:");
    if (reason === null) return;
    try {
      await db.voidPointEntry(id, reason || "Administrative reversal");
      loadLedger();
    } catch (err) {
      alert(formatError(err));
    }
  };

  const renderClassroom = () => {
    if (!assignedClass) {
      return (
        <div className="flex flex-col items-center justify-center p-20 text-center space-y-6">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-4xl grayscale opacity-50">🙈</div>
          <div>
            <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest">No Class Assigned</h3>
            <p className="text-gray-300 font-bold text-xs mt-2 uppercase">You are not scheduled for any class today.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-200">
            <Users size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">{assignedClass.name}</h2>
            <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">My Classroom • {new Date(assignedClass.date).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assignedClass.students.map((student, index) => {
            const total = totalScores[student.id] || 0;
            const daily = dailyScores[student.id] || 0;

            return (
              <button
                key={student.id}
                onClick={() => { setSelectedStudent(student); audio.playClick(); }}
                className="bg-white p-6 rounded-[2rem] border border-pink-50 shadow-sm hover:shadow-xl hover:scale-105 hover:border-pink-200 transition-all group flex flex-col items-center text-center relative overflow-hidden"
              >
                <div className="absolute top-3 right-3 text-[10px] font-black text-gray-300 group-hover:text-pink-400">
                  #{index + 1}
                </div>
                <div className="w-20 h-20 rounded-full bg-gray-50 mb-4 overflow-hidden border-2 border-white shadow-md group-hover:border-pink-200 transition-colors">
                  {student.photoUrl ? (
                    <img src={student.photoUrl} alt={student.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                  )}
                </div>
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-tight leading-tight min-h-[2.5em] flex items-center justify-center">
                  {student.fullName}
                </h3>
                <div className="mt-3 flex items-center gap-1 bg-pink-50 px-3 py-1.5 rounded-lg">
                  <Star size={12} className="text-pink-500 fill-pink-500" />
                  <span className="text-sm font-black text-pink-500">{total}</span>
                </div>
                <div className="mt-2 text-[9px] font-bold text-gray-300 uppercase">
                  Today: {daily}/50
                </div>
              </button>
            )
          })}
        </div>
      </div>
    );
  };

  const sortedLedger = useMemo(() => {
    const filtered = ledger.filter(l =>
      l.student?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      l.category.toLowerCase().includes(search.toLowerCase())
    );
    let sorted = [...filtered];
    if (mobileTab === 'DATE') {
      sorted.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    } else if (mobileTab === 'STUDENT') {
      sorted.sort((a, b) => (a.student?.fullName || '').localeCompare(b.student?.fullName || ''));
    } else if (mobileTab === 'CATEGORY') {
      sorted.sort((a, b) => a.category.localeCompare(b.category));
    }
    return sorted;
  }, [ledger, search, mobileTab]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">
            {viewMode === 'CLASSROOM' ? 'MY CLASSROOM' : 'POINTS LEDGER'}
          </h2>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">
            {viewMode === 'CLASSROOM' ? 'Manage Students & Points' : 'AUDIT TRAIL OF ALL STARS AWARDED'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {isAdmin && (
            <button
              onClick={() => setViewMode(v => v === 'LEDGER' ? 'CLASSROOM' : 'LEDGER')}
              className="bg-gray-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-200"
            >
              Switch View
            </button>
          )}
          {viewMode === 'LEDGER' && (
            <input
              type="text"
              placeholder="SEARCH BY STUDENT OR CATEGORY..."
              className="px-6 py-3.5 bg-white border border-pink-50 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-pink-200 text-[10px] font-black tracking-tight uppercase w-full md:w-80 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-20 text-center animate-pulse font-black text-pink-300 uppercase tracking-widest">
          Loading Kingdom Data...
        </div>
      ) : (
        <>
          {viewMode === 'CLASSROOM' ? renderClassroom() : (
            <>
              {/* Mobile Tabs */}
              <div className="md:hidden flex bg-gray-100 p-1 rounded-2xl mb-4">
                {['DATE', 'STUDENT', 'CATEGORY'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => { audio.playClick(); setMobileTab(tab as any); }}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${mobileTab === tab ? 'bg-white text-pink-500 shadow-sm' : 'text-gray-400'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Mobile List View */}
              <div className="md:hidden space-y-3">
                {sortedLedger.map(entry => (
                  <div key={entry.id} className={`bg-white p-4 rounded-2xl border border-pink-50 shadow-sm ${entry.voided ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {mobileTab === 'DATE' ? new Date(entry.entryDate).toLocaleDateString() :
                            mobileTab === 'STUDENT' ? entry.student?.fullName :
                              entry.category}
                        </p>
                        <h4 className="text-sm font-black text-gray-800 uppercase mt-1">
                          {mobileTab === 'STUDENT' ? entry.category : (mobileTab === 'CATEGORY' ? entry.student?.fullName : entry.student?.fullName)}
                        </h4>
                      </div>
                      <span className={`text-lg font-black ${entry.voided ? 'line-through text-gray-300' : (entry.points > 0 ? 'text-pink-500' : 'text-gray-400')}`}>
                        {entry.points > 0 ? '+' : ''}{Math.abs(entry.points)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                      <span className="text-[9px] font-bold text-gray-400 uppercase">
                        {mobileTab === 'DATE' ? entry.category : new Date(entry.entryDate).toLocaleDateString()}
                      </span>
                      <span className="text-[9px] font-bold text-gray-300 uppercase">
                        By {entry.recordedBy}
                      </span>
                    </div>
                    {entry.voided && (
                      <div className="mt-2 text-[9px] font-black text-red-400 uppercase tracking-widest bg-red-50 p-1 rounded text-center">
                        VOIDED: {entry.voidReason}
                      </div>
                    )}
                  </div>
                ))}
                {sortedLedger.length === 0 && (
                  <div className="p-10 text-center text-gray-400 font-bold text-xs uppercase">No records found</div>
                )}
              </div>

              {/* Desktop Table Section */}
              <div className="hidden md:block bg-white rounded-[2.5rem] shadow-sm border border-pink-50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/20 text-[10px] font-bold text-pink-400 uppercase tracking-widest border-b border-pink-50">
                        <th className="px-8 py-6">Date</th>
                        <th className="px-8 py-6">Student</th>
                        <th className="px-8 py-6">Category</th>
                        <th className="px-8 py-6">Points</th>
                        <th className="px-8 py-6">Recorded By</th>
                        <th className="px-8 py-6 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pink-50/30">
                      {sortedLedger.map((entry) => {
                        const isNegative = entry.points < 0;
                        return (
                          <tr key={entry.id} className={`hover:bg-pink-50/20 transition-colors ${entry.voided ? 'opacity-40' : ''}`}>
                            <td className="px-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              {new Date(entry.entryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex flex-col">
                                <span className={`font-black uppercase tracking-tight text-xs ${isNegative ? 'text-gray-300 italic' : 'text-gray-800'}`}>
                                  {entry.student?.fullName || '---'}
                                </span>
                                {!isNegative && entry.student && (
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                    {entry.student.ageGroup} GROUP
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-8 py-6 text-[10px] font-bold text-gray-500 uppercase tracking-wide">{entry.category}</td>
                            <td className="px-8 py-6">
                              <span className={`font-black text-sm ${entry.voided ? 'line-through text-gray-300' : (isNegative ? 'text-gray-400' : 'text-pink-500')}`}>
                                {Math.abs(entry.points)}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-[10px] text-gray-400 font-black uppercase tracking-wider">{entry.recordedBy}</td>
                            <td className="px-8 py-6 text-right">
                              {entry.voided ? (
                                <span className="text-gray-300 text-[9px] font-black uppercase tracking-widest border border-gray-100 px-2 py-1 rounded">[ VOID ]</span>
                              ) : (
                                isAdmin && (
                                  <button
                                    onClick={() => handleVoid(entry.id)}
                                    className="text-[9px] font-black text-gray-300 hover:text-red-500 uppercase tracking-widest transition-colors"
                                  >
                                    [ VOID ]
                                  </button>
                                )
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {sortedLedger.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-8 py-20 text-center text-gray-300 italic font-black text-[10px] uppercase tracking-[0.2em]">No ledger entries found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Give Points Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-pink-500 p-8 text-center relative">
              <button onClick={() => setSelectedStudent(null)} className="absolute top-6 right-6 text-white/50 hover:text-white text-2xl font-black">&times;</button>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Award Points</h3>
              <p className="text-pink-100 font-bold uppercase text-xs mt-1">{selectedStudent.fullName}</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-3">
              {[
                { label: 'Attendance', pts: 5 },
                { label: 'Worksheet', pts: 5 },
                { label: 'Activity', pts: 5 }, // "Activities" in prompt
                { label: 'Recitation', pts: 5 },
                { label: 'Memory Verse', pts: 10 },
                { label: 'Presentation', pts: 20 },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => handleGivePoints(action.label.toUpperCase(), action.pts)}
                  className="p-4 bg-gray-50 border border-gray-100 rounded-2xl hover:bg-pink-50 hover:border-pink-200 hover:text-pink-500 transition-all group flex flex-col items-center gap-1 active:scale-95"
                >
                  <span className="text-2xl block group-hover:scale-110 transition-transform">⭐</span>
                  <span className="text-[10px] font-black uppercase tracking-widest">{action.label}</span>
                  <span className="text-xs font-black text-gray-400 group-hover:text-pink-400">+{action.pts}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PointsLedgerPage;
