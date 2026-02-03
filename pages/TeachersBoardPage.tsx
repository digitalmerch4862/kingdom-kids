
import React, { useState, useEffect } from 'react';
import { db, formatError } from '../services/db.service';
import { TeacherAssignmentRecord } from '../types';
import { audio } from '../services/audio.service';
import { Edit2, Save, X, Loader2, Calendar, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';

const COLUMNS = [
   { key: 'age_group_3_6', label: '3-6 YEARS OLD', bg: 'bg-[#4DD0E1]', text: 'text-white' },
   { key: 'age_group_7_9', label: '7-9 YEARS OLD', bg: 'bg-[#9575CD]', text: 'text-white' },
   { key: 'teens', label: 'TEENS', bg: 'bg-[#AED581]', text: 'text-white' },
   { key: 'security', label: 'SECURITY', bg: 'bg-[#4DB6AC]', text: 'text-white' },
   { key: 'facilitators', label: 'FACILITATORS', bg: 'bg-[#9FA8DA]', text: 'text-white' }
];

const ACTIVITY_OPTIONS = [
   "Bible Stories",
   "Memory Verse",
   "Games & Quiz",
   "Arts / Made by Tiny Hands",
   "Scripture Quest: A Fun Bible Quiz & Memory Verse Day"
];

const TeachersBoardPage: React.FC = () => {
   const [boardData, setBoardData] = useState<TeacherAssignmentRecord[]>([]);
   const [loading, setLoading] = useState(true);
   const [currentMonth, setCurrentMonth] = useState(new Date());

   // Edit Modal State
   const [editingItem, setEditingItem] = useState<TeacherAssignmentRecord | null>(null);
   const [editForm, setEditForm] = useState<Partial<TeacherAssignmentRecord>>({});
   const [saving, setSaving] = useState(false);

   const [user, setUser] = useState<any>(null);

   useEffect(() => {
      loadBoard();
      const sessionStr = localStorage.getItem('km_session');
      if (sessionStr) {
         setUser(JSON.parse(sessionStr));
      }
   }, []);

   const loadBoard = async () => {
      setLoading(true);
      try {
         const data = await db.getTeacherBoard();
         setBoardData(data);
      } catch (err) {
         console.error(formatError(err));
      } finally {
         setLoading(false);
      }
   };

   // Check if user is allowed to edit (only 'rad')
   const canEdit = user?.username?.toLowerCase() === 'rad';

   const filteredData = React.useMemo(() => {
      const targetYear = currentMonth.getFullYear();
      const targetMonth = currentMonth.getMonth(); // 0-11

      return boardData
         .filter(row => {
            if (!row.activity_date) return false;
            // Parse YYYY-MM-DD manually to avoid timezone shift
            const parts = row.activity_date.split('-');
            if (parts.length < 3) return false;
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Convert to 0-11
            return year === targetYear && month === targetMonth;
         })
         .sort((a, b) => a.activity_date.localeCompare(b.activity_date));
   }, [boardData, currentMonth]);

   const handlePrevMonth = () => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
      audio.playClick();
   };

   const handleNextMonth = () => {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
      audio.playClick();
   };

   const handleAdd = () => {
      if (!canEdit) return;
      audio.playClick();
      const newItem: Partial<TeacherAssignmentRecord> = {
         id: 'new',
         activity_date: new Date().toISOString().split('T')[0],
         activity_type: ACTIVITY_OPTIONS[0],
         age_group_3_6: '',
         age_group_7_9: '',
         teens: '',
         security: '',
         facilitators: ''
      };
      setEditingItem(newItem as TeacherAssignmentRecord);
      setEditForm(newItem);
   };

   const handleEdit = (item: TeacherAssignmentRecord) => {
      if (!canEdit) return;
      audio.playClick();
      setEditingItem(item);
      setEditForm({ ...item });
   };

   const handleDelete = async () => {
      if (!editingItem || editingItem.id === 'new') return;
      if (!window.confirm("Are you sure you want to delete this schedule entry?")) return;

      setSaving(true);
      try {
         await db.deleteTeacherBoardEntry(editingItem.id);
         await loadBoard();
         setEditingItem(null);
         audio.playClick();
      } catch (err) {
         alert(formatError(err));
      } finally {
         setSaving(false);
      }
   };

   const handleSave = async () => {
      if (!editingItem || !editForm) return;
      setSaving(true);
      audio.playClick();

      try {
         if (editingItem.id === 'new') {
            const result = await db.addTeacherBoardEntry(editForm);
            // Pre-emptively add to local state to handle potential query delay
            if (result) {
               setBoardData(prev => [...prev.filter(r => r.id !== result.id), result]);
            }
         } else {
            const promises = [];

            // Update Activity Date if changed
            if (editForm.activity_date && editForm.activity_date !== editingItem.activity_date) {
               promises.push(db.updateTeacherBoardCell(editingItem.id, 'activity_date', editForm.activity_date));
            }

            // Update Activity Type if changed
            if (editForm.activity_type && editForm.activity_type !== editingItem.activity_type) {
               promises.push(db.updateTeacherBoardCell(editingItem.id, 'activity_type', editForm.activity_type));
            }

            // Update Columns if changed
            COLUMNS.forEach(col => {
               // @ts-ignore
               const val = editForm[col.key];
               // @ts-ignore
               const oldVal = editingItem[col.key];
               if (val !== oldVal) {
                  promises.push(db.updateTeacherBoardCell(editingItem.id, col.key, val || ''));
               }
            });

            await Promise.all(promises);
         }

         // Force reload from DB to ensure UI is in sync
         await loadBoard();

         setEditingItem(null);
         audio.playYehey();
      } catch (err) {
         console.error("Save error:", err);
         alert("Error saving: " + formatError(err));
      } finally {
         setSaving(false);
      }
   };

   const getDayName = (dateStr: string) => {
      if (!dateStr) return '';
      // Parse as local date to avoid timezone shift (e.g. 2026-02-01 becomes Jan 31 in some timezones if parsed as UTC)
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', { weekday: 'long' });
   }

   const getShortDate = (dateStr: string) => {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
   }

   return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">

         {/* Header */}
         <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
               <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Master Roster</h2>
               <div className="flex items-center gap-4 mt-2">
                  <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Teacher Schedules</p>
                  <div className="h-4 w-px bg-gray-200"></div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm">
                     <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-pink-500 transition-colors">
                        <ChevronLeft size={16} />
                     </button>
                     <span className="text-xs font-black text-gray-700 uppercase tracking-wider min-w-[100px] text-center">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                     </span>
                     <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-pink-500 transition-colors">
                        <ChevronRight size={16} />
                     </button>
                  </div>
               </div>
            </div>
            <div className="flex gap-2">
               {canEdit && (
                  <>
                     <button
                        onClick={handleAdd}
                        className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-[1.25rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-lg shadow-pink-200"
                     >
                        <Plus size={16} /> Add Schedule
                     </button>

                  </>
               )}
            </div>
         </div>

         {/* Main Table Container */}
         <div className="bg-white rounded-[2.5rem] shadow-sm border border-pink-50 overflow-hidden relative">
            {loading && (
               <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="animate-spin text-pink-500" size={32} />
               </div>
            )}

            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                     <tr className="text-[10px] font-bold uppercase tracking-widest">
                        <th className="px-6 py-6 bg-gray-50 text-gray-400 w-48">Date</th>
                        {COLUMNS.map(col => (
                           <th key={col.key} className={`px-6 py-6 ${col.bg} ${col.text} text-center`}>
                              {col.label}
                           </th>
                        ))}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium text-sm text-gray-600">
                     {filteredData.map((row) => (
                        <tr key={row.id} className={`hover:bg-pink-50/10 transition-colors group ${canEdit ? 'cursor-pointer' : ''}`} onClick={() => canEdit && handleEdit(row)}>
                           {/* Date Column */}
                           <td className="px-6 py-6 bg-gray-50/30">
                              <div className="flex flex-col">
                                 <span className="font-black text-gray-800 text-xs">{getShortDate(row.activity_date)}</span>
                                 <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                    {row.activity_type || 'Sunday Service'}
                                 </span>
                              </div>
                           </td>

                           {/* Assignment Columns */}
                           {COLUMNS.map(col => (
                              // @ts-ignore
                              <td key={col.key} className="px-6 py-6 text-center relative border-l border-gray-50/50">
                                 <span className="font-bold text-gray-700 uppercase text-[11px]">
                                    {/* @ts-ignore */}
                                    {row[col.key] || '-'}
                                 </span>
                              </td>
                           ))}
                        </tr>
                     ))}
                     {filteredData.length === 0 && !loading && (
                        <tr>
                           <td colSpan={COLUMNS.length + 1} className="px-8 py-20 text-center text-gray-300 font-black uppercase tracking-widest text-xs">
                              No schedule found for {currentMonth.toLocaleDateString('en-US', { month: 'long' })}.
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Edit Modal */}
         {editingItem && (
            <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">

                  {/* Modal Header */}
                  <div className="bg-pink-500 p-8 text-white flex justify-between items-start shrink-0">
                     <div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter">
                           {editingItem.id === 'new' ? 'Add Activity' : 'Edit Activity'}
                        </h3>
                        {editingItem.id !== 'new' && (
                           <p className="text-pink-100 font-bold uppercase tracking-widest text-[10px] mt-1 opacity-80">
                              {getDayName(editForm.activity_date || '')} • {getShortDate(editForm.activity_date || '')}
                           </p>
                        )}
                     </div>
                     <button onClick={() => setEditingItem(null)} className="text-white/50 hover:text-white transition-colors">
                        <X size={32} />
                     </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">

                     {/* Date & Title Section */}
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activity Date</label>
                           <div className="relative">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                              <input
                                 type="date"
                                 className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-pink-200"
                                 value={editForm.activity_date}
                                 onChange={e => setEditForm({ ...editForm, activity_date: e.target.value })}
                              />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activity Title</label>
                           <select
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-pink-200 uppercase text-xs appearance-none"
                              value={editForm.activity_type}
                              onChange={e => setEditForm({ ...editForm, activity_type: e.target.value })}
                           >
                              <option value="" disabled>Select Activity</option>
                              {ACTIVITY_OPTIONS.map(opt => (
                                 <option key={opt} value={opt}>{opt}</option>
                              ))}
                           </select>
                        </div>
                     </div>

                     <div className="h-px bg-gray-100 w-full my-2"></div>

                     {/* Assignments Grid */}
                     <div className="space-y-4">
                        <h4 className="text-xs font-black text-gray-800 uppercase tracking-widest">Team Assignments</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {COLUMNS.map(col => (
                              <div key={col.key} className="space-y-1">
                                 <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${col.bg}`}></div>
                                    {col.label}
                                 </label>
                                 <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-200 transition-all uppercase text-xs"
                                    // @ts-ignore
                                    value={editForm[col.key] || ''}
                                    // @ts-ignore
                                    onChange={e => setEditForm({ ...editForm, [col.key]: e.target.value })}
                                    placeholder="ASSIGNED TEACHER"
                                 />
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-between items-center gap-3">
                     <div>
                        {editingItem.id !== 'new' && (
                           <button
                              onClick={handleDelete}
                              disabled={saving}
                              className="px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all flex items-center gap-2"
                           >
                              <Trash2 size={16} /> Delete
                           </button>
                        )}
                     </div>
                     <div className="flex gap-3">
                        <button
                           onClick={() => setEditingItem(null)}
                           disabled={saving}
                           className="px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-200 transition-all"
                        >
                           Cancel
                        </button>
                        <button
                           onClick={handleSave}
                           disabled={saving}
                           className="px-10 py-4 bg-pink-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-pink-600 transition-all shadow-xl shadow-pink-200 flex items-center gap-2 disabled:opacity-70"
                        >
                           {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                           {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                     </div>
                  </div>

               </div>
            </div>
         )}

      </div>
   );
};

export default TeachersBoardPage;
