
import React, { useState, useEffect } from 'react';
import { db } from '../services/db.service';
import { MinistryService } from '../services/ministry.service';
import { GeminiService } from '../services/gemini.service';
import { Student, UserSession, PointLedger } from '../types';
import { audio } from '../services/audio.service';

const getFirstName = (fullName: string) => {
  if (!fullName) return "Student";
  // Handle "Last, First" format
  if (fullName.includes(',')) {
    const parts = fullName.split(',');
    return parts[1].trim().split(' ')[0];
  }
  // Handle "First Last" format
  return fullName.split(' ')[0];
};

const StudentPortalPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [student, setStudent] = useState<Student | null>(null);
  const [points, setPoints] = useState(0);
  const [rank, setRank] = useState(0);
  const [history, setHistory] = useState<PointLedger[]>([]);
  const [advice, setAdvice] = useState('LOADING YOUR KINGDOM TIPS...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPortal() {
      if (!user.studentId) return;
      
      // Guest Demo Handling
      if (user.studentId === 'GUEST_DEMO') {
        const guestStudent: Student = {
          id: 'guest-demo',
          accessKey: 'GUEST-000',
          fullName: 'Guest Visitor',
          birthday: '2018-01-01',
          ageGroup: '3-6',
          guardianName: 'Guest Parent',
          guardianPhone: '09000000000',
          isEnrolled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          consecutiveAbsences: 0,
          studentStatus: 'active'
        };
        setStudent(guestStudent);
        setPoints(100);
        setRank(1);
        setHistory([
          { id: '1', studentId: 'guest-demo', entryDate: new Date().toISOString(), category: 'Welcome Bonus', points: 50, recordedBy: 'System', voided: false, createdAt: new Date().toISOString() },
          { id: '2', studentId: 'guest-demo', entryDate: new Date().toISOString(), category: 'Memory Verse', points: 50, recordedBy: 'System', voided: false, createdAt: new Date().toISOString() }
        ]);
        setAdvice("WELCOME TO KINGDOM KIDS! THIS IS A PREVIEW OF THE STUDENT PORTAL. FEEL FREE TO EXPLORE!");
        setLoading(false);
        return;
      }

      try {
        const students = await db.getStudents();
        const me = students.find(s => s.id === user.studentId);
        if (!me) return;
        setStudent(me);

        const leaderboard = await MinistryService.getLeaderboard(me.ageGroup);
        const myEntry = leaderboard.find(e => e.id === me.id);
        
        // Rank Logic: If rank > 10, display as 11
        let myRank = leaderboard.findIndex(e => e.id === me.id) + 1;
        if (myRank > 10) myRank = 11;
        
        setPoints(myEntry?.totalPoints || 0);
        setRank(myRank);

        const ledger = await db.getPointsLedger();
        setHistory(ledger.filter(l => l.studentId === me.id && !l.voided).slice(0, 5));

        // Get AI Advice - Use first name only in prompt
        const aiAdvice = await GeminiService.getStudentAdvice(
          myEntry?.totalPoints || 0, 
          myRank, 
          me.ageGroup, 
          getFirstName(me.fullName)
        );
        setAdvice(aiAdvice);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadPortal();
  }, [user.studentId]);

  const downloadQrCode = async () => {
    if (!student) return;
    audio.playClick();
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${student.accessKey}`;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Kingdom_AccessKey_${student.accessKey}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  if (loading || !student) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <div className="w-16 h-16 bg-pink-100 rounded-full mb-4"></div>
        <p className="text-pink-300 font-black uppercase tracking-widest text-xs">Entering the Kingdom...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row items-center gap-6 bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-pink-50 shadow-sm relative overflow-hidden">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-pink-500 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center text-white text-3xl md:text-4xl font-black border-4 border-white shadow-xl shrink-0 overflow-hidden">
          {student.photoUrl ? <img src={student.photoUrl} className="w-full h-full object-cover" /> : student.fullName[0]}
        </div>
        <div className="text-center md:text-left">
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 uppercase tracking-tighter">HI, {getFirstName(student.fullName).toUpperCase()}!</h2>
          <p className="text-pink-500 font-black uppercase tracking-widest text-xs mt-1">ACCESS KEY: {student.accessKey}</p>
          <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-4">
            <span className="px-3 py-1 bg-gray-50 text-gray-400 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest">{student.ageGroup} CLASSROOM</span>
            <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest">ACTIVE PORTAL</span>
          </div>
        </div>
        <div className="hidden md:block absolute right-10 top-1/2 -translate-y-1/2 text-pink-50/50 text-8xl font-black italic select-none">PORTAL</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Scoreboard */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gradient-to-br from-pink-500 to-rose-400 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] text-white shadow-xl shadow-pink-100 text-center relative overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">My Total Stars</p>
            <p className="text-6xl md:text-7xl font-black mb-6 drop-shadow-lg">{points}</p>
            <div className="bg-white/20 p-3 md:p-4 rounded-2xl backdrop-blur-md inline-block">
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Global Rank</p>
              <p className="text-xl md:text-2xl font-black">#{rank}</p>
            </div>
            <div className="absolute top-0 right-0 p-4 text-5xl opacity-20">⭐</div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-pink-50 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Recent Activity</h3>
            <div className="space-y-4">
              {history.map(h => (
                <div key={h.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <p className="text-[10px] font-black text-gray-700 uppercase">{h.category}</p>
                    <p className="text-[8px] text-gray-400 font-bold uppercase">{new Date(h.entryDate).toLocaleDateString()}</p>
                  </div>
                  <span className="font-black text-pink-500 text-sm">+{h.points}</span>
                </div>
              ))}
              {history.length === 0 && <p className="text-center py-6 text-gray-300 font-black text-[10px] uppercase">No stars yet</p>}
            </div>
          </div>
        </div>

        {/* AI Advice & QR */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          {/* Gemini Advice Card */}
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-pink-50 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-4 mb-6 md:mb-8">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-pink-100 rounded-2xl flex items-center justify-center text-xl md:text-2xl group-hover:scale-110 transition-transform">💡</div>
              <div>
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">HOW TO RANK UP</h3>
                <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Personalized AI Advice</p>
              </div>
            </div>
            <div className="bg-pink-50/50 p-6 md:p-8 rounded-[2rem] border border-pink-100 relative">
              <p className="text-xs md:text-sm font-black text-pink-700 leading-relaxed tracking-tight whitespace-pre-wrap">
                {advice}
              </p>
              <div className="absolute -bottom-2 -right-2 text-4xl opacity-10">🤖</div>
            </div>
          </div>

          {/* QR Display */}
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-pink-50 shadow-sm text-center space-y-6">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">My Access QR</h3>
            <button 
               onClick={downloadQrCode}
               onMouseEnter={() => audio.playHover()}
               title="Click to Download Access QR"
               className="flex justify-center p-4 bg-gray-50 rounded-[2rem] md:rounded-[2.5rem] border border-gray-100 w-fit mx-auto shadow-inner hover:bg-pink-50 transition-all group/qr"
            >
               <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${student.accessKey}`} 
                 alt="Access QR" 
                 className="w-32 h-32 md:w-40 md:h-40 group-hover/qr:scale-110 transition-transform"
               />
            </button>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
              Show this Access QR to your teacher for lightning-fast check-in!
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-3">
              <button 
                onClick={downloadQrCode}
                className="px-6 md:px-8 py-3 bg-pink-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pink-600 transition-all border border-pink-600 shadow-lg shadow-pink-100"
              >
                Download Access QR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentPortalPage;
