import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db.service';
import { MinistryService, AttendanceStatusEntry } from '../services/ministry.service';
import { AttendanceSession, Student } from '../types';
import { audio } from '../services/audio.service';

const AttendanceLogsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'LOGS' | 'REPORT'>('REPORT');
  const [sessions, setSessions] = useState<(AttendanceSession & { student?: Student })[]>([]);
  const [report, setReport] = useState<AttendanceStatusEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const allSessions = await db.getAttendance();
      const students = await db.getStudents();
      const enriched = allSessions.map(s => ({
        ...s,
        student: students.find(kid => kid.id === s.studentId)
      })).sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
      
      setSessions(enriched);
      
      const rep = await MinistryService.getAttendanceReport(selectedDate);
      setReport(rep);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const filteredLogs = useMemo(() => {
    return sessions.filter(s => 
      s.student?.fullName.toLowerCase().includes(search.toLowerCase())
    );
  }, [sessions, search]);

  const filteredReport = useMemo(() => {
    return report.filter(r => 
      r.student.fullName.toLowerCase().includes(search.toLowerCase())
    );
  }, [report, search]);

  const stats = useMemo(() => {
    const present = report.filter(r => r.status === 'PRESENT').length;
    const total = report.length;
    return {
      presentCount: present,
      absentCount: total - present,
      rate: total > 0 ? Math.round((present / total) * 100) : 0
    };
  }, [report]);

  const calculateDuration = (start: string, end?: string) => {
    if (!end) return '--';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Attendance Center</h2>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Movement & Status Monitoring</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => { audio.playClick(); setSelectedDate(e.target.value); }}
            className="px-6 py-3 bg-white border border-pink-50 rounded-2xl outline-none focus:ring-2 focus:ring-pink-200 text-[10px] font-black tracking-tight uppercase shadow-sm"
          />
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
              type="text" 
              placeholder="SEARCH BY NAME..." 
              className="pl-12 pr-6 py-3.5 bg-white border border-pink-50 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-pink-200 text-[10px] font-black tracking-tight uppercase w-full md:w-64 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex bg-white p-1 rounded-2xl border border-pink-50 max-w-md shadow-sm">
        <button 
          onClick={() => { audio.playClick(); setViewMode('REPORT'); }}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'REPORT' ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-pink-500'}`}
        >
          Daily Status Report
        </button>
        <button 
          onClick={() => { audio.playClick(); setViewMode('LOGS'); }}
          className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'LOGS' ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-pink-500'}`}
        >
          Raw Movement Logs
        </button>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white px-6 py-5 rounded-[2rem] border border-pink-50 shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Registry</p>
          <p className="text-2xl font-black text-gray-800">{report.length}</p>
        </div>
        <div className="bg-white px-6 py-5 rounded-[2rem] border border-pink-50 shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 text-green-500">Present Today</p>
          <p className="text-2xl font-black text-green-600">{stats.presentCount}</p>
        </div>
        <div className="bg-white px-6 py-5 rounded-[2rem] border border-pink-50 shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 text-pink-500">Absent Today</p>
          <p className="text-2xl font-black text-pink-600">{stats.absentCount}</p>
        </div>
        <div className="bg-white px-6 py-5 rounded-[2rem] border border-pink-50 shadow-sm">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 text-blue-500">Arrival Rate</p>
          <p className="text-2xl font-black text-blue-600">{stats.rate}%</p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center animate-pulse text-pink-300 font-black uppercase tracking-[0.2em] text-[10px]">Processing Database...</div>
      ) : (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-pink-50 overflow-hidden">
          {viewMode === 'REPORT' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-bold text-pink-400 uppercase tracking-widest border-b border-pink-50">
                    <th className="px-8 py-5">Student</th>
                    <th className="px-8 py-5">Age Group</th>
                    <th className="px-8 py-5">Check-In Time</th>
                    <th className="px-8 py-5">Attendance Pts</th>
                    <th className="px-8 py-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-50/50">
                  {filteredReport.map((entry) => (
                    <tr key={entry.student.id} className={`hover:bg-pink-50/20 transition-colors ${entry.status === 'ABSENT' ? 'opacity-70 bg-gray-50/20' : ''}`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] border ${entry.status === 'PRESENT' ? 'bg-green-50 text-green-500 border-green-100' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                            {entry.student.fullName[0]}
                          </div>
                          <span className="font-black text-gray-800 uppercase tracking-tight text-xs">{entry.student.fullName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-2 py-1 bg-gray-50 text-gray-400 rounded text-[8px] font-black uppercase tracking-widest">{entry.student.ageGroup} Group</span>
                      </td>
                      <td className="px-8 py-6 text-xs text-gray-500 font-bold uppercase">
                        {entry.checkInTime ? new Date(entry.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="px-8 py-6">
                        {entry.pointsAwarded ? (
                          <span className="text-green-500 text-[10px] font-black uppercase tracking-widest">✅ AWARDED</span>
                        ) : (
                          <span className="text-gray-300 text-[10px] font-black uppercase tracking-widest">---</span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                          entry.status === 'PRESENT' ? 'bg-green-500 text-white' : 'bg-pink-50 text-pink-400'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 text-[10px] font-bold text-pink-400 uppercase tracking-widest border-b border-pink-50">
                    <th className="px-8 py-5">Date</th>
                    <th className="px-8 py-5">Student</th>
                    <th className="px-8 py-5">Age Group</th>
                    <th className="px-8 py-5">Checked In</th>
                    <th className="px-8 py-5">Checked Out</th>
                    <th className="px-8 py-5">Duration</th>
                    <th className="px-8 py-5 text-right">Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-50/50">
                  {filteredLogs.map((s) => (
                    <tr key={s.id} className="hover:bg-pink-50/20 transition-colors">
                      <td className="px-8 py-6 text-[10px] font-bold text-gray-400 uppercase">{s.sessionDate}</td>
                      <td className="px-8 py-6 font-black text-gray-800 uppercase tracking-tight text-xs">{s.student?.fullName}</td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-gray-50 text-gray-400 rounded-lg text-[9px] font-black uppercase tracking-widest">{s.student?.ageGroup}</span>
                      </td>
                      <td className="px-8 py-6 text-xs text-gray-600 font-bold uppercase">
                        {new Date(s.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-8 py-6 text-xs text-gray-600 font-bold uppercase">
                        {s.checkOutTime ? new Date(s.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="px-8 py-6 text-[10px] text-gray-400 font-black italic uppercase">{calculateDuration(s.checkInTime, s.checkOutTime)}</td>
                      <td className="px-8 py-6 text-right">
                        <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest ${s.checkoutMode === 'AUTO' ? 'bg-amber-50 text-amber-600' : 'bg-pink-50 text-pink-600'}`}>
                          {s.checkoutMode || (s.status === 'OPEN' ? 'ACTIVE' : 'MANUAL')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceLogsPage;