import React, { useState } from 'react';
import { X, Star, Award, Users, Check, AlertCircle } from 'lucide-react';
import { Student, UserSession } from '../types';
import { MinistryService } from '../services/ministry.service';
import { audio } from '../services/audio.service';
import GlobalSearch from './GlobalSearch';
import { useStudents } from '../hooks/useStudents';

interface GlobalAwardModalProps {
  user: UserSession;
  onClose: () => void;
  onSuccess?: () => void;
}

const POINT_OPTIONS = [
  { label: 'Special Achievement', pts: 10, color: 'bg-purple-100 border-purple-200 text-purple-600' },
  { label: 'Helper Award', pts: 5, color: 'bg-blue-100 border-blue-200 text-blue-600' },
  { label: 'Kindness Award', pts: 5, color: 'bg-pink-100 border-pink-200 text-pink-600' },
  { label: 'Service Award', pts: 10, color: 'bg-green-100 border-green-200 text-green-600' },
  { label: 'Leadership', pts: 15, color: 'bg-yellow-100 border-yellow-200 text-yellow-600' },
  { label: 'Best Attitude', pts: 5, color: 'bg-indigo-100 border-indigo-200 text-indigo-600' },
];

const GlobalAwardModal: React.FC<GlobalAwardModalProps> = ({ user, onClose, onSuccess }) => {
  const { students, studentsIndex, loading } = useStudents(user, { bypassGroupFilter: true });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedPointOption, setSelectedPointOption] = useState<{ label: string; pts: number; color: string } | null>(null);
  const [customPoints, setCustomPoints] = useState<number>(5);
  const [customCategory, setCustomCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const awardAmount = selectedPointOption?.pts || customPoints;
  const awardCategory = selectedPointOption?.label || customCategory;

  const handleConfirm = () => {
    if (!selectedStudent || awardAmount <= 0 || !awardCategory.trim()) {
      setError('Please select a student and point category');
      return;
    }
    setShowConfirm(true);
  };

  const handleAwardPoints = async () => {
    setConfirmed(true);
    setIsSubmitting(true);
    setError(null);

    try {
      await MinistryService.addPoints(
        selectedStudent!.id,
        awardCategory,
        awardAmount,
        user.username,
        `Global award by ${user.username}`,
        'GLOBAL_AWARD'
      );

      audio.playYehey();
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to award points');
      audio.playClick();
      setShowConfirm(false);
      setConfirmed(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-3xl p-8 text-center">
          <div className="animate-pulse font-black text-pink-500 uppercase">Loading students...</div>
        </div>
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-6 text-white relative">
            <button
              onClick={() => {
                if (!isSubmitting) {
                  setShowConfirm(false);
                  setConfirmed(false);
                }
              }}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              <X size={24} />
            </button>
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle size={24} />
              <h2 className="text-xl font-black uppercase tracking-tighter">Confirm Award</h2>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-yellow-50 rounded-2xl p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Star className="text-yellow-500" size={24} fill="currentColor" />
                <span className="text-3xl font-black text-gray-800">{awardAmount}</span>
                <Star className="text-yellow-500" size={24} fill="currentColor" />
              </div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">{awardCategory}</p>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Awarding to:</p>
              <div className="flex items-center gap-4 bg-pink-50 rounded-2xl p-4">
                <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {selectedStudent?.fullName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-black text-gray-800 uppercase">{selectedStudent?.fullName}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Users size={12} />
                    <span>{selectedStudent?.ageGroup} Group</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
              <span>Recorded by:</span>
              <span className="font-bold text-purple-500 uppercase">{user.username}</span>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-center animate-in shake">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (!isSubmitting) {
                    setShowConfirm(false);
                    setConfirmed(false);
                  }
                }}
                disabled={isSubmitting}
                className="flex-1 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAwardPoints}
                disabled={isSubmitting || confirmed}
                className="flex-1 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black rounded-2xl shadow-xl shadow-pink-200 transition-all uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>Processing...</>
                ) : confirmed ? (
                  <><Check size={16} /> Confirmed</>
                ) : (
                  <><Check size={16} /> Confirm Award</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Award size={24} />
            <h2 className="text-xl font-black uppercase tracking-tighter">Global Award</h2>
          </div>
          <p className="text-white/80 text-sm font-medium">
            Award points to any student across all groups
          </p>
        </div>

        <div className="p-6 space-y-6">
          {success ? (
            <div className="text-center py-8 animate-in fade-in">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="text-green-500" size={32} fill="currentColor" />
              </div>
              <h3 className="text-lg font-black text-gray-800 uppercase">Points Awarded!</h3>
              <p className="text-gray-400 text-sm mt-1">
                {selectedStudent?.fullName} received {awardAmount} points from {user.username}
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Search Student
                </label>
                <GlobalSearch
                  students={students}
                  studentsIndex={studentsIndex}
                  onSelect={setSelectedStudent}
                  placeholder="Type student name or group..."
                />
              </div>

              {selectedStudent && (
                <div className="bg-pink-50 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                  <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {selectedStudent.fullName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-gray-800 uppercase">{selectedStudent.fullName}</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Users size={12} />
                      <span>{selectedStudent.ageGroup} Group</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Point Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {POINT_OPTIONS.map(option => (
                    <button
                      key={option.label}
                      onClick={() => {
                        setSelectedPointOption(option);
                        setCustomCategory('');
                      }}
                      className={`px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                        selectedPointOption?.label === option.label
                          ? option.color + ' ring-2 ring-offset-1 ring-pink-200'
                          : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {option.label} <span className="opacity-70">+{option.pts}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                  Or Custom Award
                </label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => {
                    setCustomCategory(e.target.value);
                    setSelectedPointOption(null);
                  }}
                  placeholder="Custom category name..."
                  className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-pink-200 text-sm font-medium"
                />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCustomPoints(prev => Math.max(1, prev - 1));
                        setSelectedPointOption(null);
                      }}
                      className="w-10 h-10 bg-white border-2 border-gray-100 rounded-xl text-xl font-black text-gray-400 hover:bg-gray-100 transition-all"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={customPoints}
                      onChange={(e) => {
                        setCustomPoints(parseInt(e.target.value) || 0);
                        setSelectedPointOption(null);
                      }}
                      className="w-16 text-center text-2xl font-black text-gray-800 bg-transparent outline-none"
                    />
                    <button
                      onClick={() => {
                        setCustomPoints(prev => prev + 1);
                        setSelectedPointOption(null);
                      }}
                      className="w-10 h-10 bg-white border-2 border-green-100 rounded-xl text-xl font-black text-green-400 hover:bg-green-50 transition-all"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-center animate-in shake">
                  {error}
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={!selectedStudent || (!selectedPointOption && (!customCategory || customPoints <= 0))}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black rounded-2xl shadow-xl shadow-pink-200 transition-all uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
              >
                Continue to Confirm
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalAwardModal;
