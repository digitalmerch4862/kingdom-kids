
import React, { useState, useEffect } from 'react';
import { db, formatError } from '../services/db.service';
import { TeacherAssignmentRecord } from '../types';
import { audio } from '../services/audio.service';
import { Edit2, Save, X, Loader2, Calendar, Wand2 } from 'lucide-react';

const COLUMNS = [
   { key: 'age_group_3_6', label: '3-6 YEARS OLD', bg: 'bg-[#4DD0E1]', text: 'text-white' },
   { key: 'age_group_7_9', label: '7-9 YEARS OLD', bg: 'bg-[#9575CD]', text: 'text-white' },
   { key: 'teens', label: 'TEENS', bg: 'bg-[#AED581]', text: 'text-white' },
   { key: 'security', label: 'SECURITY', bg: 'bg-[#4DB6AC]', text: 'text-white' },
   { key: 'facilitators', label: 'FACILITATORS', bg: 'bg-[#9FA8DA]', text: 'text-white' }
];

const TeachersBoardPage: React.FC = () => {
   const [boardData, setBoardData] = useState<TeacherAssignmentRecord[]>([]);
   const [loading, setLoading] = useState(true);

   // Edit Modal State
   const [editingItem, setEditingItem] = useState<TeacherAssignmentRecord | null>(null);
   const [editForm, setEditForm] = useState<Partial<TeacherAssignmentRecord>>({});
   const [saving, setSaving] = useState(false);

   useEffect(() => {
      loadBoard();
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

   const handleEdit = (item: TeacherAssignmentRecord) => {
      audio.playClick();
      setEditingItem(item);
      setEditForm({ ...item });
   };

   const handleSave = async () => {
      if (!editingItem || !editForm) return;
      setSaving(true);
      audio.playClick();

      try {
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

         // Wait for all updates to finish
         await Promise.all(promises);

         // Force reload from DB to ensure UI is in sync
         await loadBoard();

         setEditingItem(null);
         audio.playYehey();
      } catch (err) {
         alert(formatError(err));
      } finally {
         setSaving(false);
      }
   };

   const getDayName = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { weekday: 'long' });
   }

   const getShortDate = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
   }

   return (
      <div className="space-y-8 animate-in fade-in duration-500 pb-20">

         {/* Header */}
         <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
               <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Master Roster</h2>
               <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Teacher Schedules & Assignments</p>
            </div>
            <div className="flex gap-2">
               <button className="bg-gray-100 hover:bg-gray-200 text-gray-500 px-6 py-3 rounded-[1.25rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2">
                  <Wand2 size={14} /> Auto-Fill
               </button>
            </div>
         </div>

         {/* Main Table Container */}
         {!loading && (() => {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let sundayCount = 0;
            for (let d = 1; d <= daysInMonth; d++) {
               if (new Date(year, month, d).getDay() === 0) sundayCount++;
            }
            return sundayCount === 5;
         })() ? (
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
                        {boardData.map((row) => (
                           <tr key={row.id} className="hover:bg-pink-50/10 transition-colors group cursor-pointer" onClick={() => handleEdit(row)}>
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
                        {boardData.length === 0 && !loading && (
                           <tr>
                              <td colSpan={COLUMNS.length + 1} className="px-8 py-20 text-center text-gray-300 font-black uppercase tracking-widest text-xs">
                                 No schedule found. Use SQL Editor to generate.
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         ) : (
            <div className="bg-gray-50 p-20 rounded-[2.5rem] border border-gray-100 text-center">
               <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm">📅</div>
               <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest">Teachers Board Hidden</h3>
               <p className="text-gray-300 font-bold text-xs mt-2 uppercase tracking-wide max-w-md mx-auto">
                  This content is only available during months with a 5th Sunday.
               </p>
            </div>
         )}

         {/* Edit Modal */}
         {editingItem && (
            <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">

                  {/* Modal Header */}
                  <div className="bg-pink-500 p-8 text-white flex justify-between items-start shrink-0">
                     <div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter">Edit Activity</h3>
                        <p className="text-pink-100 font-bold uppercase tracking-widest text-[10px] mt-1 opacity-80">
                           {getDayName(editForm.activity_date || '')} • {getShortDate(editForm.activity_date || '')}
                        </p>
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
                           <input
                              type="text"
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 outline-none focus:ring-2 focus:ring-pink-200 uppercase"
                              value={editForm.activity_type}
                              onChange={e => setEditForm({ ...editForm, activity_type: e.target.value })}
                           />
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
                  <div className="p-6 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
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
         )}

      </div>
   );
};

export default TeachersBoardPage;
