import React, { useState, useEffect, useMemo } from 'react';
import { db, formatError } from '../services/db.service';
import { PointLedger, Student, UserSession, TeacherAssignmentRecord } from '../types';
import { audio } from '../services/audio.service';
import { AlertTriangle, Star, Users, ArrowLeft, Trophy } from 'lucide-react';
import GlobalAwardModal from '../components/GlobalAwardModal';

const PointsLedgerPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [viewMode, setViewMode] = useState<'LEDGER' | 'CLASSROOM' | 'GLOBAL_AWARD'>(user.role === 'TEACHER' ? 'CLASSROOM' : 'LEDGER');

  // Ledger State
  const [ledger, setLedger] = useState<(PointLedger & { student?: Student; facilitatorProfile?: any })[]>([]);
  const [search, setSearch] = useState('');
  const [mobileTab, setMobileTab] = useState<'DATE' | 'STUDENT' | 'CATEGORY'>('DATE');

  // Classroom State
  const [assignedClass, setAssignedClass] = useState<{ name: string, students: Student[], date: string } | null>(null);
  const [dailyScores, setDailyScores] = useState<Record<string, number>>({});
  const [totalScores, setTotalScores] = useState<Record<string, number>>({});
  const [classroomSearch, setClassroomSearch] = useState('');
  /* New State for 2-Step Workflow */
  const [selectedAction, setSelectedAction] = useState<{ label: string, pts: number } | null>(null);

  const ACTIONS = [
    { label: 'WORKSHEET / ACTIVITIES', pts: 5 },
    { label: 'MEMORY VERSE', pts: 10 },
    { label: 'RECITATION', pts: 5 },
    { label: 'PRESENTATION', pts: 20 },
  ];

  const [loading, setLoading] = useState(true);
  const isAdmin = user.role === 'ADMIN';

  useEffect(() => {
    if (viewMode === 'LEDGER') {
      loadLedger();
    } else if (viewMode === 'CLASSROOM') {
      loadClassroom();
    }
  }, [viewMode]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const allEntries = await db.getPointsLedger();
      const students = await db.getStudents();
      
      const facilitatorUsernames = new Set(
        allEntries
          .filter(e => e.recordedBy && !students.find(s => s.id === e.studentId)?.fullName?.toUpperCase().includes(e.recordedBy.toUpperCase()))
          .map(e => e.recordedBy)
      );
      
      const facilitatorProfiles: Record<string, any> = {};
      for (const username of facilitatorUsernames) {
        if (username && username !== 'SYSTEM' && username !== 'SYSTEM_AUTO') {
          const profile = await db.getTeacherProfile(username);
          if (profile) {
            facilitatorProfiles[username] = profile;
          }
        }
      }
      
      const enriched = allEntries.map(entry => ({
        ...entry,
        student: students.find(s => s.id === entry.studentId),
        facilitatorProfile: facilitatorProfiles[entry.recordedBy] || null
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
      const universalAccessUsers = ['CHING', 'BETH', 'GIDEON', 'LEE', 'MAGI', 'MARGE'];
      if (!targetAgeGroup && (isAdmin || universalAccessUsers.includes(userName))) {
        targetAgeGroup = 'ALL';
        className = 'ALL CLASSES';
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

  /* Replaced handleGivePoints with handleQuickAward */
  const handleQuickAward = async (student: Student) => {
    if (!assignedClass) return;

    if (!selectedAction) {
      alert("Please select an action from the top bar first!");
      return;
    }

    // Check Daily Limit (50)
    const currentDaily = dailyScores[student.id] || 0;
    if (currentDaily + selectedAction.pts > 50) {
      alert(`Daily limit reached! Student has ${currentDaily}/50 points today.`);
      return;
    }

    try {
      audio.playYehey(); // Play sound immediately for better feedback
      await db.addPointEntry({
        studentId: student.id,
        entryDate: assignedClass.date,
        category: selectedAction.label,
        points: selectedAction.pts,
        notes: `Classroom Award: ${assignedClass.name}`,
        recordedBy: user.username
      });

      // Optimistic Update or Reload
      loadClassroom();
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

  const filteredStudents = useMemo(() => {
    if (!assignedClass) return [];
    if (!classroomSearch.trim()) return assignedClass.students;
    return assignedClass.students.filter(s => 
      s.fullName.toLowerCase().includes(classroomSearch.toLowerCase())
    );
  }, [assignedClass, classroomSearch]);

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

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="SEARCH STUDENTS..."
            className="w-full px-6 py-3 bg-white border border-pink-50 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-pink-200 text-[10px] font-black tracking-tight uppercase shadow-sm"
            value={classroomSearch}
            onChange={(e) => setClassroomSearch(e.target.value)}
          />
        </div>

        {/* Sticky Action Bar */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md py-4 mb-6 border-b border-pink-50 -mx-4 px-4 md:px-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2 shrink-0">I-STAR POINTS:</span>
            {ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => {
                  audio.playClick();
                  setSelectedAction(prev => prev?.label === action.label ? null : action);
                }}
                className={`
                       relative px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 border
                       ${selectedAction?.label === action.label
                    ? 'bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-200 scale-105'
                    : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50 hover:border-pink-200'}
                    `}
              >
                {action.label} <span className="opacity-60 ml-1">+{action.pts}</span>
                {selectedAction?.label === action.label && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                )}
              </button>
            ))}
          </div>
          {selectedAction ? (
            <div className="text-center mt-2 animate-in fade-in slide-in-from-top-1">
              <p className="text-[10px] font-bold text-pink-500 uppercase tracking-widest">
                Select a student below to award <span className="font-black">{selectedAction.pts} points</span> for {selectedAction.label}
              </p>
            </div>
          ) : (
            <div className="text-center mt-2">
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Select an activity above first</p>
            </div>
          )}
        </div>

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
          {filteredStudents.map((student, index) => {
            const total = totalScores[student.id] || 0;
            const daily = dailyScores[student.id] || 0;

            return (
              <button
                key={student.id}
                onClick={() => handleQuickAward(student)}
                disabled={!selectedAction}
                className={`
                  bg-white p-6 rounded-[2rem] border shadow-sm transition-all group flex flex-col items-center text-center relative overflow-hidden
                  ${!selectedAction ? 'opacity-70 grayscale cursor-not-allowed border-gray-100' : 'hover:shadow-xl hover:scale-105 border-pink-50 hover:border-pink-200 cursor-pointer'}
                `}
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
          {filteredStudents.length === 0 && (
            <div className="col-span-full p-10 text-center text-gray-400 font-bold text-xs uppercase">
              No students found matching "{classroomSearch}"
            </div>
          )}
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
          {(isAdmin || user.role === 'FACILITATOR' || user.role === 'TEACHER') && viewMode === 'LEDGER' && (
            <button
              onClick={() => setViewMode('GLOBAL_AWARD')}
              className="bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-pink-200 hover:scale-105 transition-transform"
            >
              + Global Award
            </button>
          )}
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
          {viewMode === 'GLOBAL_AWARD' && (
            <GlobalAwardModal
              user={user}
              onClose={() => setViewMode('LEDGER')}
              onSuccess={() => {
                loadLedger();
              }}
            />
          )}
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
                            <td className="px-8 py-6">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-wider">
                                  {entry.recordedBy}
                                </span>
                                {entry.facilitatorProfile && (
                                  <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mt-0.5">
                                    {entry.facilitatorProfile.age_group || 'STAFF'}
                                  </span>
                                )}
                                {!entry.facilitatorProfile && entry.recordedBy !== 'SYSTEM' && entry.recordedBy !== 'SYSTEM_AUTO' && (
                                  <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest mt-0.5">
                                    Facilitator
                                  </span>
                                )}
                              </div>
                            </td>
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



    </div>
  );
};

export default PointsLedgerPage;
