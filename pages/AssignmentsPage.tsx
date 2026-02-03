
import React, { useState, useEffect } from 'react';
import { db, formatError } from '../services/db.service';
import { Assignment, UserSession } from '../types';
import { audio } from '../services/audio.service';

const AssignmentsPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    teacherName: user.username,
    title: '',
    deadline: '',
    taskDetails: '',
    ageGroup: 'ALL'
  });

  const isTeacherOrAdmin = user.role === 'TEACHER' || user.role === 'ADMIN';

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const data = await db.getAssignments();
      setAssignments(data);
    } catch (err) {
      console.error(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAssignments(); }, []);

  const handlePostAssignment = async () => {
    // 1. Collect Data & Debug Log
    console.log("Post Assignment Clicked. Data:", formData);

    // 2. Validate
    if (!formData.title.trim()) {
      alert("PLEASE ENTER A TITLE FOR THE ASSIGNMENT.");
      return;
    }
    if (!formData.deadline) {
      alert("PLEASE SELECT A DEADLINE DATE.");
      return;
    }

    setIsSaving(true);
    audio.playClick();

    try {
      // 3. Send to Database
      await db.addAssignment({
        teacherName: formData.teacherName,
        title: formData.title.toUpperCase(),
        deadline: formData.deadline,
        taskDetails: formData.taskDetails,
        ageGroup: formData.ageGroup === 'ALL' ? undefined : formData.ageGroup
      });

      // 4. Success Handling
      audio.playYehey();
      alert("ASSIGNMENT POSTED SUCCESSFULLY!");
      
      setShowAddModal(false);
      setFormData({ teacherName: user.username, title: '', deadline: '', taskDetails: '', ageGroup: 'ALL' });
      loadAssignments();
    } catch (err) {
      console.error("Assignment Insert Failed:", err);
      alert("FAILED TO POST: " + formatError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this assignment?")) return;
    audio.playClick();
    try {
      await db.deleteAssignment(id);
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(formatError(err));
    }
  };

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-pink-300 uppercase">Loading Assignments...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Assignments</h2>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Ministry Tasks & Lessons</p>
        </div>
        {isTeacherOrAdmin && (
          <button 
            onClick={() => { audio.playClick(); setShowAddModal(true); }}
            className="bg-pink-500 text-white px-8 py-3.5 rounded-[1.25rem] font-black transition-all shadow-xl shadow-pink-100 uppercase tracking-widest text-[12px]"
          >
            + Create Assignment
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignments.map((a) => (
          <div key={a.id} className="bg-white p-8 rounded-[2.5rem] border border-pink-50 shadow-sm space-y-4 hover:shadow-xl hover:shadow-pink-100/30 transition-all relative group">
            {isTeacherOrAdmin && (
              <button 
                onClick={() => handleDelete(a.id)}
                className="absolute top-6 right-6 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                🗑️
              </button>
            )}
            <div className="flex justify-between items-start">
              <span className="px-3 py-1 bg-pink-50 text-pink-500 text-[8px] font-black rounded-full uppercase tracking-widest">
                {a.ageGroup || 'ALL AGES'}
              </span>
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                Due: {new Date(a.deadline).toLocaleDateString()}
              </span>
            </div>
            <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">{a.title}</h3>
            <p className="text-xs text-gray-500 font-medium line-clamp-3 leading-relaxed">{a.taskDetails}</p>
            <div className="pt-4 border-t border-pink-50 flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 font-black text-[10px]">
                {a.teacherName ? a.teacherName[0] : 'T'}
              </div>
              <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Teacher: {a.teacherName}</p>
            </div>
          </div>
        ))}
        {assignments.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[3rem] border border-pink-50 text-center text-gray-300 font-black uppercase tracking-widest text-xs">
            No assignments posted yet.
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-pink-500 p-10 text-white relative">
              <h3 className="text-2xl font-black uppercase tracking-tighter">New Assignment</h3>
              <p className="text-pink-100 text-[10px] font-black uppercase tracking-widest opacity-80">Post a new task for the kids</p>
              <button onClick={() => { audio.playClick(); setShowAddModal(false); }} className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors text-3xl font-black leading-none">&times;</button>
            </div>
            
            <div className="p-10 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Teacher Name</label>
                <input type="text" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px]" value={formData.teacherName} onChange={e => setFormData({ ...formData, teacherName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assignment Title</label>
                <input type="text" placeholder="Ex: Memory Verse Memorization" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px]" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Deadline</label>
                  <input type="date" className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px]" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Age Group</label>
                  <select className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-black text-gray-700 text-[12px] uppercase" value={formData.ageGroup} onChange={e => setFormData({ ...formData, ageGroup: e.target.value })}>
                    <option value="ALL">All Groups</option>
                    <option value="3-6">3-6 Years</option>
                    <option value="7-9">7-9 Years</option>
                    <option value="10-12">10-12 Years</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Task Details</label>
                <textarea rows={4} placeholder="Describe the task here..." className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px] resize-none" value={formData.taskDetails} onChange={e => setFormData({ ...formData, taskDetails: e.target.value })} />
              </div>
              
              <button 
                type="button" 
                onClick={handlePostAssignment}
                disabled={isSaving} 
                className="w-full py-5 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-2xl shadow-xl shadow-pink-100 transition-all uppercase tracking-widest text-[12px] disabled:opacity-50"
              >
                {isSaving ? 'PROCESSING...' : 'POST ASSIGNMENT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentsPage;
