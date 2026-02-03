import React, { useState, useEffect } from 'react';
import CameraScanner from '../components/CameraScanner';
import { db } from '../services/db.service';
import { FaceService } from '../services/gemini.service';
import { Student, FaceAngle } from '../types';

const FACE_DATA_FOLDER = 'https://drive.google.com/drive/folders/1wqA1YaiVcrtEKr2jiAp683e-HzyVPGyo?usp=sharing';

const EnrollmentPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [step, setStep] = useState<FaceAngle>('front');
  const [embeddings, setEmbeddings] = useState<Partial<Record<FaceAngle, number[]>>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    db.getStudents().then(list => setStudents(list.filter(s => !s.isEnrolled)));
  }, []);

  const handleCapture = async (base64: string) => {
    if (!selectedId) return alert('Select a student first');
    
    setLoading(true);
    try {
      const embedding = await FaceService.generateEmbedding(base64);
      
      // Update local embeddings and state
      const newEmbeddings: Partial<Record<FaceAngle, number[]>> = { 
        ...embeddings, 
        [step]: embedding 
      };
      setEmbeddings(newEmbeddings);
      
      if (step === 'front') setStep('left');
      else if (step === 'left') setStep('right');
      else {
        // Completed enrollment - use the local updated object for processing final insertion
        const angles: FaceAngle[] = ['front', 'left', 'right'];
        for (const angle of angles) {
          const vec = newEmbeddings[angle];
          // Ensure we only add valid embedding arrays to the database
          if (vec && Array.isArray(vec)) {
            await db.addEmbedding({
              studentId: selectedId,
              angle: angle,
              embedding: vec
            });
          }
        }
        await db.updateStudent(selectedId, { isEnrolled: true });
        await db.log({
          eventType: 'ENROLLMENT',
          actor: 'ADMIN',
          entityId: selectedId,
          payload: { completed: true }
        });
        setSuccess(true);
      }
    } catch (err) {
      console.error("Enrollment error:", err);
      alert("An error occurred during face enrollment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-12 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Enrollment Complete!</h2>
        <p className="text-gray-500 font-medium">Face profile for {students.find(s => s.id === selectedId)?.fullName} is now active.</p>
        <div className="pt-6 flex flex-col gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="bg-pink-500 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-pink-100 uppercase tracking-widest text-xs"
          >
            Enroll Another Student
          </button>
          <a 
            href={FACE_DATA_FOLDER}
            target="_blank"
            rel="noreferrer"
            className="text-pink-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-pink-600 transition-colors"
          >
            View Face Storage →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Face Enrollment</h2>
        <p className="text-gray-400 font-medium">Capture 3 angles to create a secure face profile.</p>
        <div className="pt-2">
          <a 
            href={FACE_DATA_FOLDER}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-500 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-pink-100 transition-all border border-pink-100"
          >
            <span>📁</span> Open Face Data Folder
          </a>
        </div>
      </div>

      {!selectedId ? (
        <div className="bg-white p-10 rounded-[3rem] border border-pink-50 shadow-sm space-y-4">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Student to Enroll</label>
          <select 
            className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 font-bold text-gray-700 appearance-none cursor-pointer"
            onChange={e => setSelectedId(e.target.value)}
          >
            <option value="">-- CHOOSE STUDENT --</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.fullName} ({s.ageGroup})</option>)}
          </select>
          <p className="text-[10px] text-gray-300 italic text-center font-medium uppercase tracking-tight">Only students without face data appear in this list.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-center gap-3">
            {(['front', 'left', 'right'] as FaceAngle[]).map(a => (
              <div 
                key={a}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  embeddings[a] ? 'bg-green-500 text-white shadow-lg shadow-green-100' : step === a ? 'bg-pink-500 text-white shadow-lg shadow-pink-100' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {a} {embeddings[a] ? '✓' : ''}
              </div>
            ))}
          </div>

          <CameraScanner 
            label={loading ? 'PROCESSING...' : `CAPTURE ${step.toUpperCase()} VIEW`}
            onCapture={handleCapture}
            isScanning={loading}
          />

          <div className="text-center space-y-3">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest animate-pulse">
              Ensure face is clearly visible & centered.
            </p>
            <button 
              onClick={() => setSelectedId('')}
              className="text-[9px] font-black text-gray-300 hover:text-pink-500 uppercase tracking-widest transition-colors"
            >
              [ Switch Student ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentPage;