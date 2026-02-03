
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MinistryService, LeaderboardEntry } from '../services/ministry.service';
import { db, formatError } from '../services/db.service';
import { AgeGroup, UserSession, Student, PointLedger } from '../types';
import { DEFAULT_POINT_RULES } from '../constants';
import { audio } from '../services/audio.service';

const ClassroomPage: React.FC = () => {
  const { group } = useParams<{ group: string }>();
  const navigate = useNavigate();
  const [roster, setRoster] = useState<LeaderboardEntry[]>([]);
  const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  
  // Award Points Modal State
  const [selectedStudent, setSelectedStudent] = useState<LeaderboardEntry | null>(null);
  const [studentHistory, setStudentHistory] = useState<PointLedger[]>([]);
  const [manualPoints, setManualPoints] = useState(5);
  const [selectedCategory, setSelectedCategory] = useState('Manual Adjustment');
  const [isAwarding, setIsAwarding] = useState(false);
  const [awardError, setAwardError] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  
  // Edit Profile Modal State
  const [editingProfile, setEditingProfile] = useState<Student | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    guardianName: '',
    guardianPhone: '',
    notes: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  // History State for Undo/Redo
  const [undoStack, setUndoStack] = useState<Array<{points: number, category: string}>>([]);
  const [redoStack, setRedoStack] = useState<Array<{points: number, category: string}>>([]);
  
  // Limit Popup State
  const [limitError, setLimitError] = useState<string | null>(null);

  const sessionStr = localStorage.getItem('km_session');
  const user: UserSession | null = sessionStr ? JSON.parse(sessionStr) : null;

  const loadClassroom = async () => {
    setLoading(true);
    const lb = await MinistryService.getLeaderboard(group as AgeGroup);
    setRoster(lb);

    const sessions = await db.getAttendance();
    const today = new Date().toISOString().split('T')[0];
    const open = new Set(sessions.filter(s => s.sessionDate === today && s.status === 'OPEN').map(s => s.studentId));
    setActiveSessions(open);
    setLoading(false);
  };

  useEffect(() => {
    loadClassroom();
  }, [group]);

  // Load history when selected student changes
  useEffect(() => {
    if (selectedStudent) {
      db.getStudentLedger(selectedStudent.id)
        .then(setStudentHistory)
        .catch(console.error);
    }
  }, [selectedStudent]);

  // Reset modal state when opening a new student
  const openModal = (student: LeaderboardEntry) => {
    audio.playClick();
    setSelectedStudent(student);
    setManualPoints(5);
    setSelectedCategory('Manual Adjustment');
    setAwardError('');
    // Clear history when opening new modal session
    setUndoStack([]);
    setRedoStack([]);
  };

  // Switch student from within modal (Next/Prev) - preserve input settings
  const switchToStudent = (student: LeaderboardEntry) => {
    audio.playClick();
    setSelectedStudent(student);
    setAwardError('');
    setUndoStack([]);
    setRedoStack([]);
  };

  const handlePrevStudent = () => {
    if (!selectedStudent) return;
    const currentIndex = roster.findIndex(s => s.id === selectedStudent.id);
    if (currentIndex > 0) {
      switchToStudent(roster[currentIndex - 1]);
    }
  };

  const handleNextStudent = () => {
    if (!selectedStudent) return;
    const currentIndex = roster.findIndex(s => s.id === selectedStudent.id);
    if (currentIndex < roster.length - 1) {
      switchToStudent(roster[currentIndex + 1]);
    }
  };

  const handleStudentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const studentId = e.target.value;
    const student = roster.find(s => s.id === studentId);
    if (student) switchToStudent(student);
  };

  const closeModal = () => {
    audio.playClick();
    setSelectedStudent(null);
    setStudentHistory([]);
  };

  // Edit Profile Handlers
  const openEditModal = (student: LeaderboardEntry) => {
    audio.playClick();
    setEditingProfile(student);
    setEditFormData({
      fullName: student.fullName,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      notes: student.notes || ''
    });
    setProfileError('');
  };

  const closeEditModal = () => {
    audio.playClick();
    setEditingProfile(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    
    setIsSavingProfile(true);
    setProfileError('');
    audio.playClick();

    try {
      await db.updateStudent(editingProfile.id, {
        fullName: editFormData.fullName.toUpperCase(),
        guardianName: editFormData.guardianName.toUpperCase(),
        guardianPhone: editFormData.guardianPhone,
        notes: editFormData.notes
      });

      // Update local roster state immediately
      setRoster(prev => prev.map(s => 
        s.id === editingProfile.id 
          ? { 
              ...s, 
              fullName: editFormData.fullName.toUpperCase(),
              guardianName: editFormData.guardianName.toUpperCase(),
              guardianPhone: editFormData.guardianPhone,
              notes: editFormData.notes
            } 
          : s
      ));

      setEditingProfile(null);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2000);
      audio.playYehey();
    } catch (err: any) {
      console.error("Profile update failed:", err);
      setProfileError(formatError(err));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Core transaction logic - Returns true if successful
  const processTransaction = async (category: string, points: number): Promise<boolean> => {
    if (!selectedStudent || !user) return false;
    
    setIsAwarding(true);
    setAwardError('');
    
    try {
      await MinistryService.addPoints(
        selectedStudent.id,
        category,
        points,
        user.username,
        `Point transaction in ${group} classroom`
      );
      
      // Update local roster state immediately
      setRoster(prev => prev.map(s => 
        s.id === selectedStudent.id 
          ? { ...s, totalPoints: s.totalPoints + points } 
          : s
      ));
      
      // Refresh History
      const updatedHistory = await db.getStudentLedger(selectedStudent.id);
      setStudentHistory(updatedHistory);

      // Visual feedback
      if (points > 0) audio.playYehey();
      else audio.playClick();

      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2000);
      return true;

    } catch (err: any) {
      if (err.message && (err.message.includes('limit') || err.message.includes('Limit'))) {
        setLimitError(err.message);
      } else {
        setAwardError(err.message || "Failed to update points.");
        // Play error sound/feedback here if available
      }
      return false;
    } finally {
      setIsAwarding(false);
    }
  };

  const handleQuickAdd = (category: string, points: number) => {
    setManualPoints(points);
    setSelectedCategory(category);
  };

  // 1. New Action (Clear redo, add to undo)
  const handleAddPoints = async () => {
    audio.playClick();
    const success = await processTransaction(selectedCategory, manualPoints);
    if (success) {
      setUndoStack(prev => [...prev, { points: manualPoints, category: selectedCategory }]);
      setRedoStack([]); // Clear redo stack on new action
    }
  };

  // 2. Undo Action (Pop undo, add negative, push to redo)
  const handleUndo = async () => {
    if (undoStack.length === 0 || isAwarding) return;
    audio.playClick();
    
    const lastAction = undoStack[undoStack.length - 1];
    
    // Apply negative points to reverse
    const success = await processTransaction(`Undo: ${lastAction.category}`, -lastAction.points);
    
    if (success) {
      setUndoStack(prev => prev.slice(0, -1)); // Remove last
      setRedoStack(prev => [...prev, lastAction]); // Add to redo
    }
  };

  // 3. Redo Action (Pop redo, re-add positive, push to undo)
  const handleRedo = async () => {
    if (redoStack.length === 0 || isAwarding) return;
    audio.playClick();

    const nextAction = redoStack[redoStack.length - 1];
    
    // Re-apply original points
    const success = await processTransaction(`Redo: ${nextAction.category}`, nextAction.points);
    
    if (success) {
      setRedoStack(prev => prev.slice(0, -1)); // Remove from redo
      setUndoStack(prev => [...prev, nextAction]); // Add back to undo
    }
  };

  const scorePresets = [
    { label: 'Attendance', pts: 5, bg: 'bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-200' },
    { label: 'Worksheet', pts: 5, bg: 'bg-indigo-100 text-indigo-600 border-indigo-200 hover:bg-indigo-200' },
    { label: 'Memory Verse', pts: 10, bg: 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200' },
    { label: 'Recitation', pts: 10, bg: 'bg-cyan-100 text-cyan-600 border-cyan-200 hover:bg-cyan-200' },
    { label: 'Presentation', pts: 20, bg: 'bg-lime-100 text-lime-700 border-lime-200 hover:bg-lime-200' },
  ];

  if (loading) return <div className="p-10 text-center animate-pulse uppercase font-black text-pink-300">Loading Classroom...</div>;

  const currentStudentIndex = selectedStudent ? roster.findIndex(s => s.id === selectedStudent.id) : -1;
  const hasPrev = currentStudentIndex > 0;
  const hasNext = currentStudentIndex >= 0 && currentStudentIndex < roster.length - 1;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 relative">
      <div className="flex items-center gap-4">
        <button 
          onMouseEnter={() => audio.playHover()}
          onClick={() => { audio.playClick(); navigate(-1); }} 
          className="p-3 bg-white border border-pink-50 rounded-2xl hover:bg-pink-50 transition-all shadow-sm"
        >
          ←
        </button>
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 uppercase tracking-tighter">Classroom: {group} Years</h2>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Roster and live activity</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-pink-50 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-pink-50 flex justify-between items-center bg-gray-50/30">
          <h3 className="font-black text-gray-800 text-sm uppercase tracking-widest">Student Roster</h3>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{roster.length} Total Students</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] font-bold text-pink-400 uppercase tracking-widest border-b border-pink-50">
                <th className="px-8 py-5">Student Name</th>
                <th className="px-8 py-5">Face Status</th>
                <th className="px-8 py-5">Presence Today</th>
                <th className="px-8 py-5">Points</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50/50">
              {roster.map((student) => (
                <tr key={student.id} className="hover:bg-pink-50/20 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center text-pink-500 font-black text-xs border border-pink-100">
                        {student.fullName[0]}
                      </div>
                      <span className="font-bold text-gray-800 uppercase tracking-tight text-xs md:text-sm">{student.fullName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${student.isEnrolled ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                      {student.isEnrolled ? 'ENROLLED' : 'NO DATA'}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    {activeSessions.has(student.id) ? (
                      <span className="flex items-center gap-2 text-green-600 text-[10px] font-black uppercase tracking-widest">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Present
                      </span>
                    ) : (
                      <span className="text-gray-300 text-[10px] font-bold uppercase tracking-widest">Absent</span>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-800">{student.totalPoints}</span>
                      <span className="text-[9px] text-pink-400 font-black">PTS</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right space-x-2 flex justify-end items-center">
                    <button 
                      onMouseEnter={() => audio.playHover()}
                      onClick={() => openEditModal(student)}
                      className="w-10 h-10 bg-white border border-pink-100 text-pink-400 rounded-xl flex items-center justify-center hover:bg-pink-50 transition-all shadow-sm active:scale-95 text-lg"
                      title="Edit Profile"
                    >
                      ✏️
                    </button>
                    <button 
                      onMouseEnter={() => audio.playHover()}
                      onClick={() => openModal(student)}
                      className="px-5 py-2.5 bg-pink-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-pink-100 hover:bg-pink-600 transition-all active:scale-95"
                    >
                      Update Points
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Award Points Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[95vh]">
            <div className="bg-pink-500 p-6 md:p-8 text-white relative shrink-0">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter">Adjust Stars</h3>
                <button 
                  onClick={closeModal} 
                  className="text-white/50 hover:text-white transition-colors text-3xl font-black leading-none"
                  disabled={isAwarding}
                >
                  &times;
                </button>
              </div>

              {/* Navigation Header */}
              <div className="flex items-center justify-between gap-4">
                <button 
                  onClick={handlePrevStudent}
                  disabled={!hasPrev || isAwarding}
                  className="p-3 bg-pink-400/30 hover:bg-pink-400/50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="text-xl font-black">←</span>
                </button>
                
                <div className="flex-1 min-w-0">
                  <select 
                     value={selectedStudent.id}
                     onChange={handleStudentSelect}
                     className="w-full bg-pink-600/50 text-white font-black uppercase tracking-tight text-center text-lg md:text-xl rounded-xl px-2 py-2 outline-none border border-pink-400/50 appearance-none cursor-pointer hover:bg-pink-600/70 transition-colors"
                  >
                     {roster.map(s => (
                       <option key={s.id} value={s.id} className="text-gray-800 bg-white">
                         {s.fullName}
                       </option>
                     ))}
                  </select>
                  <p className="text-pink-100 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80 text-center">
                    Current Balance: {selectedStudent.totalPoints}
                  </p>
                </div>

                <button 
                  onClick={handleNextStudent}
                  disabled={!hasNext || isAwarding}
                  className="p-3 bg-pink-400/30 hover:bg-pink-400/50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="text-xl font-black">→</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">
              
              {/* Easy Scoring Buttons (I-STAR System) */}
              <div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-3 text-center">Quick Add (I-STAR)</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {scorePresets.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handleQuickAdd(preset.label, preset.pts)}
                      className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95 flex items-center gap-1 ${
                        selectedCategory === preset.label ? 'ring-2 ring-pink-300 ring-offset-1 ' + preset.bg : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {preset.label} <span className="opacity-50">+{preset.pts}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Adjustment Section */}
              <div className="bg-gray-50 p-4 md:p-6 rounded-[2rem] border border-gray-100 text-center space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Point Calculator</label>
                <div className="flex items-center justify-center gap-4 md:gap-6">
                  <button 
                    onMouseEnter={() => audio.playHover()}
                    onClick={() => { audio.playClick(); setManualPoints(prev => Math.max(0, prev - 1)); }}
                    className="w-10 h-10 md:w-14 md:h-14 bg-white border-2 border-gray-100 rounded-2xl text-xl md:text-2xl font-black text-gray-400 hover:bg-gray-100 transition-all active:scale-90 flex items-center justify-center"
                  >
                    -
                  </button>
                  <div className="text-3xl md:text-4xl font-black w-16 md:w-24 tabular-nums text-gray-800">
                    {manualPoints}
                  </div>
                  <button 
                    onMouseEnter={() => audio.playHover()}
                    onClick={() => { audio.playClick(); setManualPoints(prev => prev + 1); }}
                    className="w-10 h-10 md:w-14 md:h-14 bg-white border-2 border-green-100 rounded-2xl text-xl md:text-2xl font-black text-green-400 hover:bg-green-50 transition-all active:scale-90 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
                
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Reason for adjustment</p>
                  <select 
                    value={selectedCategory}
                    onChange={(e) => { audio.playClick(); setSelectedCategory(e.target.value); }}
                    className="w-full bg-white border border-gray-100 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-pink-100 cursor-pointer"
                  >
                    <option value="Manual Adjustment">Manual Addition</option>
                    {DEFAULT_POINT_RULES.map(r => <option key={r.category} value={r.category}>{r.category}</option>)}
                  </select>
                </div>

                <button 
                  onMouseEnter={() => audio.playHover()}
                  onClick={handleAddPoints}
                  disabled={isAwarding || manualPoints === 0}
                  className="w-full py-3 md:py-4 font-black rounded-2xl uppercase tracking-widest text-xs shadow-xl transition-all bg-pink-500 text-white shadow-pink-100 hover:bg-pink-600 disabled:opacity-50"
                >
                  {isAwarding ? 'PROCESSING...' : `ADD ${manualPoints} POINTS`}
                </button>
              </div>

              {/* Undo / Redo Controls */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0 || isAwarding}
                  onMouseEnter={() => audio.playHover()}
                  className={`py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border flex items-center justify-center gap-2 ${
                    undoStack.length === 0 
                      ? 'bg-gray-100 text-gray-300 border-transparent cursor-not-allowed' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm active:scale-95'
                  }`}
                >
                  <span className="text-sm">↩️</span> Undo
                </button>

                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0 || isAwarding}
                  onMouseEnter={() => audio.playHover()}
                  className={`py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border flex items-center justify-center gap-2 ${
                    redoStack.length === 0 
                      ? 'bg-gray-100 text-gray-300 border-transparent cursor-not-allowed' 
                      : 'bg-white text-pink-500 border-pink-100 hover:bg-pink-50 hover:border-pink-200 shadow-sm active:scale-95'
                  }`}
                >
                  Redo <span className="text-sm">↪️</span>
                </button>
              </div>

              {/* Transaction History Section */}
              <div className="border-t border-gray-100 pt-6">
                <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Recent Activity (Last 5)</h5>
                <div className="space-y-2">
                  {studentHistory.map((entry) => (
                    <div key={entry.id} className={`flex justify-between items-center p-4 rounded-2xl border ${entry.voided ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-pink-50 shadow-sm'}`}>
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-black uppercase tracking-tight ${entry.voided ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                           {entry.category}
                        </span>
                        <div className="flex gap-2 text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                           <span>{new Date(entry.entryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                           <span className="text-gray-300">•</span>
                           <span>{entry.recordedBy}</span>
                        </div>
                      </div>
                      <div className="text-right">
                         <span className={`text-sm font-black ${entry.voided ? 'text-gray-300' : (entry.points > 0 ? 'text-pink-500' : 'text-gray-400')}`}>
                           {entry.points > 0 ? '+' : ''}{entry.points}
                         </span>
                         {entry.voided && <div className="text-[7px] font-black text-red-400 uppercase tracking-widest mt-0.5">VOIDED</div>}
                      </div>
                    </div>
                  ))}
                  {studentHistory.length === 0 && (
                    <p className="text-center text-[9px] text-gray-300 font-bold uppercase py-4 italic border-2 border-dashed border-gray-50 rounded-2xl">
                      No recent activity for this student.
                    </p>
                  )}
                </div>
              </div>

              {awardError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-center animate-in shake">
                  {awardError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-pink-500 p-8 text-white relative">
              <h3 className="text-xl font-black uppercase tracking-tighter">Edit Student</h3>
              <p className="text-pink-100 text-[10px] font-black uppercase tracking-widest opacity-80">
                Updating details for {editingProfile.fullName}
              </p>
              <button 
                onClick={closeEditModal} 
                className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors text-3xl font-black leading-none"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSaveProfile} className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                <input 
                  type="text" 
                  value={editFormData.fullName}
                  onChange={e => setEditFormData({...editFormData, fullName: e.target.value.toUpperCase()})}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px] uppercase"
                  placeholder="STUDENT NAME"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Guardian Name</label>
                  <input 
                    type="text" 
                    value={editFormData.guardianName}
                    onChange={e => setEditFormData({...editFormData, guardianName: e.target.value.toUpperCase()})}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px] uppercase"
                    placeholder="PARENT NAME"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact No.</label>
                  <input 
                    type="text" 
                    value={editFormData.guardianPhone}
                    onChange={e => setEditFormData({...editFormData, guardianPhone: e.target.value})}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px]"
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notes</label>
                <textarea 
                  value={editFormData.notes}
                  onChange={e => setEditFormData({...editFormData, notes: e.target.value})}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px] resize-none"
                  placeholder="Medical notes, allergies, etc..."
                  rows={3}
                />
              </div>

              {profileError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-center animate-in shake">
                  {profileError}
                </div>
              )}

              <button 
                type="submit"
                disabled={isSavingProfile}
                className="w-full py-4 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-2xl shadow-xl shadow-pink-100 transition-all uppercase tracking-widest text-[12px] disabled:opacity-50"
              >
                {isSavingProfile ? 'SAVING CHANGES...' : 'SAVE STUDENT DETAILS'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Limit Reached Popup */}
      {limitError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-300 border-4 border-pink-100">
              <div className="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl animate-bounce">
                🛑
              </div>
              <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight mb-2">Daily Limit Hit</h3>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-relaxed mb-8">{limitError}</p>
              <button 
                onClick={() => { audio.playClick(); setLimitError(null); }} 
                className="w-full bg-pink-500 hover:bg-pink-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-pink-200 transition-all active:scale-95"
              >
                 Okay, Understood
              </button>
           </div>
        </div>
      )}

      {showSuccessToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] bg-gray-800 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <span className="text-xl">✨</span>
          <span className="text-xs font-black uppercase tracking-widest">Changes Saved Successfully</span>
        </div>
      )}
    </div>
  );
};

export default ClassroomPage;
