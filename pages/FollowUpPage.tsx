
import React, { useState, useEffect } from 'react';
import { db, formatError } from '../services/db.service';
import { Student, UserSession } from '../types';
import { audio } from '../services/audio.service';

const getFirstName = (fullName: string) => {
  if (!fullName) return "Kid";
  if (fullName.includes(',')) {
    const parts = fullName.split(',');
    return parts[1].trim().split(' ')[0];
  }
  return fullName.split(' ')[0];
};

const FollowUpPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await db.getStudents();
      // Filter: Absences > 0 AND active status
      setStudents(all.filter(s => s.consecutiveAbsences > 0 && s.studentStatus === 'active'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getSmsTemplate = (student: Student, count: number) => {
    const childName = student.fullName;
    const childNickname = getFirstName(student.fullName);
    const guardianNickname = student.guardianNickname || getFirstName(student.guardianName) || "Parent";
    const teacherName = user.username;

    if (count === 1) {
      return `Hi ${childNickname} 😊\nWe missed you at Sunday Church today! 💛\nHope you’re doing well. See you next Sunday! 🙏✨\n– Teacher ${teacherName}`;
    }
    if (count === 2) {
      return `Hello ${guardianNickname}, this is Teacher ${teacherName} from Sunday Church.\n${childNickname} was absent today, just checking in to see if everything is okay. 💛\nWe look forward to seeing ${childNickname} next Sunday! 🙏`;
    }
    if (count >= 3) {
      return `Hi ${childNickname} 👋\nWe missed you in church today 😊\nDon’t forget—Sunday School is every Sunday at 10 am. See you soon! 🙏\nTeacher ${teacherName}`;
    }
    return '';
  };

  const handleSendSms = (student: Student) => {
    audio.playClick();
    setSelectedStudent(student);
  };

  const confirmSend = async () => {
    if (!selectedStudent) return;
    
    const msg = getSmsTemplate(selectedStudent, selectedStudent.consecutiveAbsences);
    const url = `sms:${selectedStudent.guardianPhone}?body=${encodeURIComponent(msg)}`;
    
    // Log in DB
    await db.recordFollowUp(selectedStudent.id, user.username);
    
    // Open SMS app
    window.location.href = url;
    
    // Close modal
    setSelectedStudent(null);
    audio.playYehey();
  };

  const AbsenceColumn = ({ count, title, badgeColor }: { count: number; title: string; badgeColor: string }) => {
    // Group logic: 1 -> count=1, 2 -> count=2, 3+ -> count=3
    const list = students.filter(s => count >= 3 ? s.consecutiveAbsences >= 3 : s.consecutiveAbsences === count);
    
    return (
      <div className="bg-white rounded-[2rem] border border-pink-50 p-6 flex flex-col h-full shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-gray-800 uppercase tracking-tight text-sm">{title}</h3>
          <span className={`px-2 py-1 rounded-full text-[9px] font-black text-white ${badgeColor}`}>
            {list.length}
          </span>
        </div>
        
        <div className="space-y-4 overflow-y-auto max-h-[600px] custom-scrollbar flex-1">
          {list.map(s => (
            <div key={s.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-pink-200 transition-all group">
              <div className="flex justify-between items-start mb-3">
                <div>
                   <h4 className="font-black text-gray-800 uppercase tracking-tight text-xs">{s.fullName}</h4>
                   <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{s.ageGroup} Group</p>
                </div>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white ${badgeColor}`}>
                  {s.consecutiveAbsences}
                </div>
              </div>
              
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                Guardian: {s.guardianName}
              </div>

              {s.lastFollowupSent && (
                <p className="text-[8px] text-pink-400 font-bold uppercase tracking-widest mb-3">
                  Last Msg: {new Date(s.lastFollowupSent).toLocaleDateString()}
                </p>
              )}

              <button 
                onClick={() => handleSendSms(s)}
                className="w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-pink-500 hover:text-white hover:border-pink-500 transition-all shadow-sm"
              >
                Send SMS
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <p className="text-center text-gray-300 font-black text-[10px] uppercase py-10 italic">No students here.</p>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-pink-300 uppercase">Checking Attendance Records...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col pb-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 shrink-0">
        <div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Shepherd's Watch</h2>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">Follow-Up Monitoring System</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        <AbsenceColumn count={1} title="Missed 1 Sunday" badgeColor="bg-yellow-400" />
        <AbsenceColumn count={2} title="Missed 2 Sundays" badgeColor="bg-orange-400" />
        <AbsenceColumn count={3} title="High Alert (3+)" badgeColor="bg-red-500" />
      </div>

      {/* SMS Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-pink-500 p-8 text-white relative">
              <h3 className="text-xl font-black uppercase tracking-tighter">Send Follow-Up</h3>
              <p className="text-pink-100 text-[10px] font-black uppercase tracking-widest opacity-80">
                Connecting with {getFirstName(selectedStudent.fullName)}
              </p>
              <button 
                onClick={() => setSelectedStudent(null)} 
                className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors text-3xl font-black leading-none"
              >
                &times;
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Message Preview</p>
                 <p className="text-xs font-medium text-gray-700 whitespace-pre-wrap leading-relaxed">
                   {getSmsTemplate(selectedStudent, selectedStudent.consecutiveAbsences)}
                 </p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="flex-1 py-4 text-gray-400 font-black hover:bg-gray-50 rounded-2xl transition-all uppercase tracking-widest text-[10px]"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmSend}
                  className="flex-1 py-4 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-2xl shadow-xl shadow-pink-100 transition-all uppercase tracking-widest text-[10px]"
                >
                  Open Messages
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #fce7f3; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default FollowUpPage;
