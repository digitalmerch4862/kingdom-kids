
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ActivitySchedule } from '../types';
import { MinistryService } from '../services/ministry.service';

const TeacherDashboard: React.FC<{ activity: ActivitySchedule | null }> = ({ activity }) => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    MinistryService.getLeaderboard().then(setLeaderboard);
  }, []);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-pink-500 to-rose-400 text-white p-8 rounded-3xl shadow-xl">
        <h2 className="text-3xl font-bold mb-2">Teacher Station</h2>
        <p className="opacity-90">Ready to welcome the kids? Start scanning or award points.</p>
        
        {activity && (
          <div className="mt-6 bg-white/20 p-4 rounded-xl border border-white/20 backdrop-blur-sm">
            <span className="text-xs uppercase font-bold tracking-wider">Today's Sunday Activity</span>
            <p className="text-xl font-medium">{activity.title}</p>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link to="/teacher/scan" className="group p-6 bg-white rounded-3xl shadow-sm border border-pink-50 hover:border-pink-200 transition-all flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">📸</div>
              <h3 className="font-bold text-lg text-gray-800">Face Scan Check-in</h3>
              <p className="text-sm text-gray-500">Scan child's face to mark attendance</p>
            </Link>
            
            <div className="group p-6 bg-white rounded-3xl shadow-sm border border-pink-50 hover:border-pink-200 transition-all flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">⭐</div>
              <h3 className="font-bold text-lg text-gray-800">Award Points</h3>
              <p className="text-sm text-gray-500">Give stars for memory verses & more</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-50">
            <h3 className="font-bold text-gray-800 mb-4">Checked-in List (Live)</h3>
            <p className="text-sm text-gray-400">Scan kids to see them appear here...</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-pink-50">
          <h3 className="font-bold text-gray-800 mb-4">Leaderboard</h3>
          <div className="space-y-3">
            {leaderboard.slice(0, 5).map((kid, i) => (
              <div key={kid.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-pink-400">#{i + 1}</span>
                  <span className="font-medium text-gray-700">{kid.fullName}</span>
                </div>
                <span className="font-bold text-gray-800">{kid.totalPoints} <small className="text-xs text-pink-400">pts</small></span>
              </div>
            ))}
            {leaderboard.length === 0 && <p className="text-sm text-gray-400 italic text-center">No scores yet</p>}
          </div>
          <button className="w-full mt-4 text-sm font-bold text-pink-500 hover:underline">View Full Leaderboard &rarr;</button>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
