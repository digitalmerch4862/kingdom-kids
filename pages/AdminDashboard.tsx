
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, formatError } from '../services/db.service';
import { MinistryService } from '../services/ministry.service';
import { ActivitySchedule, AttendanceSession, Student, UserSession } from '../types';
import { audio } from '../services/audio.service';
import { Search, X, UserPlus, UserPlus2, TrendingUp, TrendingDown, Minus, Calendar, Loader2, Check } from 'lucide-react';
import ManualEntryForm from '../components/ManualEntryForm';

const getFirstName = (fullName: string) => {
  if (!fullName) return "Student";
  if (fullName.includes(',')) {
    const parts = fullName.split(',');
    return parts[1].trim().split(' ')[0];
  }
  return fullName.split(' ')[0];
};

interface WeekStats {
  weekNumber: number;
  attendanceRate: number;
  presentCount: number;
  pointsIssued: number;
  label: string;
  dateStr: string;
}

const AdminDashboard: React.FC<{ activity: ActivitySchedule | null }> = ({ activity }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(new Date());
  const [stats, setStats] = useState({
    totalStudents: 0,
    checkedInCount: 0,
    absentCount: 0,
    attendanceRate: 0,
    totalPointsToday: 0
  });

  const [weeklyComparison, setWeeklyComparison] = useState<{
    weeks: WeekStats[];
    monthName: string;
  } | null>(null);

  const [activeSessions, setActiveSessions] = useState<(AttendanceSession & { student?: Student })[]>([]);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [birthdays, setBirthdays] = useState<Student[]>([]);
  const [error, setError] = useState('');

  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [isCheckingIn, setIsCheckingIn] = useState<string | null>(null);

  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualEntryType, setManualEntryType] = useState<'alumni' | 'guest'>('guest');

  const user: UserSession | null = useMemo(() => {
    const sessionStr = sessionStorage.getItem('km_session');
    if (!sessionStr) return null;
    try {
      return JSON.parse(sessionStr);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'manual') {
      const type = params.get('type') as 'alumni' | 'guest';
      setManualEntryType(type || 'guest');
      setShowManualEntryModal(true);
    }
  }, [location.search]);

  const closeManualEntry = () => {
    setShowManualEntryModal(false);
    navigate('/admin', { replace: true });
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  async function loadDashboard() {
    try {
      setError('');
      const students = await db.getStudents();
      const bdays = await db.getBirthdaysThisMonth();
      const sessions = await db.getAttendance();
      const ledger = await db.getPointsLedger();
      const todayDate = new Date();
      const todayStr = todayDate.toISOString().split('T')[0];

      const currentSessions = sessions.filter(s => s.sessionDate === todayStr && s.status === 'OPEN');
      const todayPoints = ledger.filter(l => l.entryDate === todayStr && !l.voided).reduce((sum, curr) => sum + curr.points, 0);

      const actualRate = students.length > 0 ? Math.round((currentSessions.length / students.length) * 100) : 0;

      const sessionsWithDetails = currentSessions.map(sess => ({
        ...sess,
        student: students.find(s => s.id === sess.studentId)
      }));

      // --- DYNAMIC SUNDAY LOGIC ---
      const year = todayDate.getFullYear();
      const month = todayDate.getMonth();
      const monthName = todayDate.toLocaleString('default', { month: 'long' });

      // Find all Sundays in this month
      const sundays: Date[] = [];
      const d = new Date(year, month, 1);
      while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
      while (d.getMonth() === month) {
        sundays.push(new Date(d));
        d.setDate(d.getDate() + 7);
      }

      const weeksData = sundays.map((sun, idx) => {
        const dateStr = sun.toISOString().split('T')[0];
        const weekSessions = sessions.filter(s => s.sessionDate === dateStr);
        const uniquePresent = new Set(weekSessions.map(s => s.studentId)).size;
        const weekPoints = ledger.filter(l => l.entryDate === dateStr && !l.voided)
          .reduce((sum, curr) => sum + curr.points, 0);

        const weekRate = students.length > 0 ? Math.round((uniquePresent / students.length) * 100) : 0;

        return {
          weekNumber: idx + 1,
          attendanceRate: weekRate,
          presentCount: uniquePresent,
          pointsIssued: weekPoints,
          label: sun.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase(),
          dateStr
        };
      });

      setWeeklyComparison({ weeks: weeksData, monthName });
      setStats({
        totalStudents: students.length,
        checkedInCount: currentSessions.length,
        absentCount: students.length - currentSessions.length,
        attendanceRate: actualRate,
        totalPointsToday: todayPoints
      });
      setActiveSessions(sessionsWithDetails);
      setBirthdays(bdays);

      const classroomStats = await MinistryService.getClassroomStats();
      setClassrooms(classroomStats);
      setAllStudents(students);
    } catch (e: any) {
      setError(formatError(e));
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleManualCheckIn = async (studentId: string) => {
    if (isCheckingIn) return;
    setIsCheckingIn(studentId);
    audio.playClick();
    try {
      await MinistryService.checkIn(studentId, user?.username || 'ADMIN');
      audio.playYehey();
      loadDashboard();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsCheckingIn(null);
    }
  };

  const filteredManualStudents = useMemo(() => {
    if (!manualSearch.trim()) return [];
    const query = manualSearch.toLowerCase();
    return allStudents.filter(s => {
      const nameMatch = (s.fullName || "").toLowerCase().includes(query);
      const keyMatch = (s.accessKey || "").toLowerCase().includes(query);
      return nameMatch || keyMatch;
    }).slice(0, 8);
  }, [allStudents, manualSearch]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-pink-500 to-rose-400 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-6xl font-black uppercase tracking-tighter">Admin Station</h2>
          <p className="opacity-90 font-medium uppercase tracking-widest text-xs mt-1">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>

          {activity && (
            <div className="mt-6 bg-white/20 p-4 rounded-2xl border border-white/20 backdrop-blur-md inline-block">
              <span className="text-[10px] uppercase font-black tracking-widest opacity-75 block mb-1">Current Activity</span>
              <p className="text-lg font-bold">{activity.title}</p>
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 p-10 opacity-10 font-black text-9xl italic select-none">KINGDOMKIDS</div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Check-In', path: '/admin/qr-scan', icon: '📸' },
          { label: 'Register', path: '/admin/students', icon: '👤' },
          { label: 'Points', path: '/admin/points', icon: '⭐' },
          { label: 'Ask AI', path: '/admin/ask-ai', icon: '✨' },
          { label: 'Excel Import', path: '/admin/import', icon: '📥' }
        ].map((a, i) => (
          <button
            key={i}
            onClick={() => a.onClick ? a.onClick() : navigate(a.path!)}
            className="flex items-center gap-4 bg-white p-4 rounded-[1.5rem] border border-pink-50 shadow-sm hover:bg-pink-50 hover:border-pink-100 transition-all group"
          >
            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-inner">
              {a.icon}
            </div>
            <div className="text-left">
              <span className="text-xs font-black text-gray-800 uppercase group-hover:text-pink-600">{a.label}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Registry', value: stats.totalStudents, color: 'text-gray-800' },
          { label: 'Present Today', value: stats.checkedInCount, color: 'text-green-600' },
          { label: 'Absent Today', value: stats.absentCount, color: 'text-pink-500' },
          { label: 'Stars Issued', value: stats.totalPointsToday, color: 'text-blue-600' }
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-pink-50 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-pink-50 shadow-sm">
            <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm mb-6 flex items-center justify-between">
              Classroom Activity
              <span className="text-[10px] text-pink-500 font-black px-3 py-1 bg-pink-50 rounded-full">LIVE</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {classrooms.map((c, i) => (
                <div key={i} className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 group hover:border-pink-200 transition-all cursor-pointer" onClick={() => navigate(`/classrooms/${c.group}`)}>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{c.group} Years</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-black text-gray-800">{c.present}</p>
                    <p className="text-[10px] font-bold text-gray-400">OF {c.total}</p>
                  </div>
                  <div className="mt-4 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-500" style={{ width: `${(c.present / (c.total || 1)) * 100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-pink-50 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Active Sessions</h3>
              <button onClick={() => navigate('/admin/logs')} className="text-[10px] font-black text-pink-500 uppercase hover:underline">View All Logs</button>
            </div>
            <div className="space-y-4">
              {activeSessions.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-pink-500 text-xs shadow-sm border border-pink-50">
                      {s.student?.fullName?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{s.student?.fullName || 'Unknown Student'}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{s.student?.ageGroup || 'N/A'} Group</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-gray-800">{new Date(s.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-[8px] font-bold text-green-500 uppercase tracking-widest">In Progress</p>
                  </div>
                </div>
              ))}
              {activeSessions.length === 0 && (
                <div className="py-12 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest border-2 border-dashed border-gray-50 rounded-[2rem]">
                  No active sessions found today
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">

          <div className="bg-pink-50 p-8 rounded-[2.5rem] border border-pink-100 shadow-sm">
            <h3 className="font-black text-pink-600 uppercase tracking-widest text-sm mb-6 flex items-center gap-2">
              🎂 Birthdays <span className="text-[10px] bg-white px-2 py-0.5 rounded-full">{birthdays.length}</span>
            </h3>
            <div className="space-y-3">
              {birthdays.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm border border-pink-100">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🎈</span>
                    <div>
                      <p className="text-[10px] font-black text-gray-800 uppercase tracking-tight">{s.fullName}</p>
                      <p className="text-[8px] font-bold text-pink-400 uppercase tracking-widest">
                        {new Date(s.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center text-[10px] font-black text-pink-400">
                    {db.calculateAge(s.birthday)}
                  </div>
                </div>
              ))}
              {birthdays.length === 0 && (
                <p className="text-center py-6 text-[10px] font-black text-pink-300 uppercase italic">No birthdays this month</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-pink-500 p-8 text-white relative">
              <h3 className="text-xl font-black uppercase tracking-tighter">Manual Check-In</h3>
              <p className="text-pink-100 text-[10px] font-black uppercase tracking-widest opacity-80">Quickly find and record attendance</p>
              <button onClick={() => setShowManualModal(false)} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors text-2xl">&times;</button>
            </div>
            <div className="p-8 space-y-6">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  placeholder="SEARCH NAME OR KEY..."
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 font-bold text-gray-700 uppercase"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {filteredManualStudents.map(s => {
                  const isAlreadyCheckedIn = activeSessions.some(session => session.studentId === s.id);
                  return (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-pink-200 transition-all">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs font-black text-gray-800 uppercase tracking-tight truncate flex items-center gap-2">
                        {s.fullName}
                        {isAlreadyCheckedIn && <Check size={14} className="text-green-500" />}
                      </p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{s.accessKey}</p>
                    </div>
                    {!isAlreadyCheckedIn && (
                    <button
                      onClick={() => handleManualCheckIn(s.id)}
                      disabled={isCheckingIn === s.id}
                      className="bg-pink-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-pink-100 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isCheckingIn === s.id ? <Loader2 className="animate-spin" size={12} /> : 'IN'}
                    </button>
                    )}
                  </div>
                );
                })}
                {manualSearch.length > 0 && filteredManualStudents.length === 0 && (
                  <div className="py-6 flex flex-col items-center">
                    <button
                      onClick={() => {
                        audio.playClick();
                        setShowManualModal(false);
                        navigate('/admin/students?action=register');
                      }}
                      className="bg-pink-500 hover:bg-pink-600 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-pink-100 transition-all uppercase tracking-widest text-[11px] active:scale-95"
                    >
                      REGISTER NEW KINGDOM KID
                    </button>
                  </div>
                )}
                {manualSearch.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 opacity-40">
                    <Search size={32} className="text-gray-300" />
                    <p className="text-center text-[9px] text-gray-400 font-bold uppercase">Type to search for students</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showManualEntryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <ManualEntryForm
            initialType={manualEntryType}
            onClose={closeManualEntry}
            onSuccess={loadDashboard}
          />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
