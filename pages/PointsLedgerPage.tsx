
import React, { useState, useEffect, useMemo } from 'react';
import { db, formatError } from '../services/db.service';
import { PointLedger, Student, UserSession } from '../types';
import { audio } from '../services/audio.service';
import { AlertTriangle } from 'lucide-react';

const PointsLedgerPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [ledger, setLedger] = useState<(PointLedger & { student?: Student })[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<'DATE' | 'STUDENT' | 'CATEGORY'>('DATE');

  const isAdmin = user.role === 'ADMIN';

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

  useEffect(() => {
    loadLedger();
  }, []);

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

  const filtered = useMemo(() => {
    return ledger.filter(l => 
      l.student?.fullName.toLowerCase().includes(search.toLowerCase()) ||
      l.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [ledger, search]);

  const sortedLedger = useMemo(() => {
    let sorted = [...filtered];
    if (mobileTab === 'DATE') {
      sorted.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    } else if (mobileTab === 'STUDENT') {
      sorted.sort((a, b) => (a.student?.fullName || '').localeCompare(b.student?.fullName || ''));
    } else if (mobileTab === 'CATEGORY') {
      sorted.sort((a, b) => a.category.localeCompare(b.category));
    }
    return sorted;
  }, [filtered, mobileTab]);

  if (loading) return <div className="p-10 text-center animate-pulse font-black text-pink-300 uppercase">Loading Ledger...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">POINTS LEDGER</h2>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">AUDIT TRAIL OF ALL STARS AWARDED</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <input 
            type="text" 
            placeholder="SEARCH BY STUDENT OR CATEGORY..." 
            className="px-6 py-3.5 bg-white border border-pink-50 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-pink-200 text-[10px] font-black tracking-tight uppercase w-full md:w-80 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="md:hidden flex bg-gray-100 p-1 rounded-2xl mb-4">
        {['DATE', 'STUDENT', 'CATEGORY'].map(tab => (
          <button
            key={tab}
            onClick={() => { audio.playClick(); setMobileTab(tab as any); }}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              mobileTab === tab ? 'bg-white text-pink-500 shadow-sm' : 'text-gray-400'
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
              {filtered.map((entry) => {
                const isNegative = entry.points < 0;
                
                return (
                  <tr key={entry.id} className={`hover:bg-pink-50/20 transition-colors ${entry.voided ? 'opacity-40' : ''}`}>
                    {/* Date */}
                    <td className="px-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {new Date(entry.entryDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    
                    {/* Student */}
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
                        {isNegative && (
                          <span className="text-[8px] font-bold text-pink-300 uppercase tracking-tighter">
                            DEDUCTION (ANONYMIZED)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-8 py-6 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                      {entry.category}
                    </td>

                    {/* Points */}
                    <td className="px-8 py-6">
                      <span className={`font-black text-sm ${entry.voided ? 'line-through text-gray-300' : (isNegative ? 'text-gray-400' : 'text-pink-500')}`}>
                        {Math.abs(entry.points)}
                      </span>
                    </td>

                    {/* Recorded By */}
                    <td className="px-8 py-6 text-[10px] text-gray-400 font-black uppercase tracking-wider">
                      {entry.recordedBy}
                    </td>

                    {/* Status */}
                    <td className="px-8 py-6 text-right">
                      {entry.voided ? (
                        <span className="text-gray-300 text-[9px] font-black uppercase tracking-widest border border-gray-100 px-2 py-1 rounded">
                          [ VOID ]
                        </span>
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
              
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-gray-300 italic font-black text-[10px] uppercase tracking-[0.2em]">
                    No ledger entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PointsLedgerPage;
