import React, { useState, useEffect } from 'react';
import CameraScanner from '../components/CameraScanner';
import { FaceService } from '../services/gemini.service';
import { db, formatError } from '../services/db.service';
import { MinistryService } from '../services/ministry.service';
import { UserSession, Student, FaceEmbedding } from '../types';

const getFirstName = (fullName: string) => {
  if (!fullName) return "Student";
  if (fullName.includes(',')) {
    const parts = fullName.split(',');
    return parts[1].trim().split(' ')[0];
  }
  return fullName.split(' ')[0];
};

const FaceScanPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [match, setMatch] = useState<{ student: Student; confidence: number; alreadyCheckedIn?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allEmbeddings, setAllEmbeddings] = useState<FaceEmbedding[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);

  useEffect(() => {
    db.getEmbeddings().then(setAllEmbeddings).catch(err => console.error(err));
    db.getStudents().then(setAllStudents).catch(err => console.error(err));
  }, []);

  const handleScan = async (base64: string) => {
    setIsProcessing(true);
    setMatch(null);
    setError(null);

    try {
      const currentEmb = await FaceService.generateEmbedding(base64);
      const settings = await db.getSettings();
      let bestMatch: { studentId: string; confidence: number } | null = null;

      for (const known of allEmbeddings) {
        const sim = FaceService.cosineSimilarity(currentEmb, known.embedding);
        if (sim >= settings.matchThreshold) {
          if (!bestMatch || sim > bestMatch.confidence) {
            bestMatch = { studentId: known.studentId, confidence: sim };
          }
        }
      }

      if (bestMatch) {
        const studentId = bestMatch.studentId;
        const student = allStudents.find(s => s.id === studentId);
        if (student) {
          try {
            await MinistryService.checkIn(student.id, user.username);
            setMatch({ student, confidence: bestMatch.confidence });
          } catch (e: any) {
            setMatch({ student, confidence: bestMatch.confidence, alreadyCheckedIn: true });
          }
        }
      } else {
        setError("UNKNOWN FACE DETECTED");
        await db.log({
          eventType: 'FACE_UNKNOWN',
          actor: user.username,
          payload: { timestamp: new Date().toISOString() }
        });
      }
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Face Check-In</h2>
        <p className="text-gray-400 font-medium">Scan student face to check in automatically.</p>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-pink-50 relative overflow-hidden">
        <div className="max-w-md mx-auto space-y-8">
          <div className="aspect-square bg-gray-50 rounded-[2.5rem] overflow-hidden border-4 border-pink-100 shadow-inner relative">
            <CameraScanner 
              onCapture={handleScan} 
              isScanning={isProcessing} 
              label={isProcessing ? "ANALYZING..." : "SCAN FACE"} 
            />
          </div>

          <div className="min-h-[120px] flex flex-col items-center justify-center border-2 border-dashed border-pink-50 rounded-[2rem] p-6 text-center">
            {!match && !error && !isProcessing && (
              <p className="text-gray-300 font-bold text-sm uppercase tracking-widest">Waiting for face capture...</p>
            )}

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex gap-1 justify-center">
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                </div>
                <p className="text-pink-500 font-black text-xs uppercase tracking-widest">Searching Records...</p>
              </div>
            )}

            {match && (
              <div className="animate-in zoom-in-95 duration-300 space-y-1">
                <div className="inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-50 text-green-600 mb-2">
                  {match.alreadyCheckedIn ? 'ALREADY PRESENT' : 'CHECK-IN SUCCESS'}
                </div>
                <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">{getFirstName(match.student.fullName)}</h3>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{match.student.ageGroup} GROUP • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-green-500 text-[9px] font-bold mt-2">Confidence: {(match.confidence * 100).toFixed(1)}%</p>
              </div>
            )}

            {error && (
              <div className="animate-in shake duration-300 space-y-2">
                <p className="text-red-500 font-black text-sm uppercase tracking-widest">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="bg-red-50 text-red-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                >
                  RETRY SCAN
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button className="flex-1 py-4 bg-gray-50 text-gray-400 font-bold rounded-2xl uppercase tracking-widest text-xs hover:bg-gray-100 transition-all">Cancel</button>
            <button 
              disabled={!match}
              className={`flex-1 py-4 font-bold rounded-2xl uppercase tracking-widest text-xs transition-all ${
                match ? 'bg-pink-500 text-white shadow-lg shadow-pink-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              Confirm Check-In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaceScanPage;