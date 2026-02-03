
import React, { useState, useRef } from 'react';
import CameraScanner from '../components/CameraScanner';
import { db, formatError } from '../services/db.service';
import { MinistryService } from '../services/ministry.service';
import { audio } from '../services/audio.service';
import jsQR from 'jsqr';

const getFirstName = (fullName: string) => {
  if (!fullName) return "Student";
  if (fullName.includes(',')) {
    const parts = fullName.split(',');
    return parts[1].trim().split(' ')[0];
  }
  return fullName.split(' ')[0];
};

const QRScanPage: React.FC<{ username: string }> = ({ username }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{ name: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async (base64: string) => {
    // Prevent overlapping scans if we are already processing or showing a result
    if (isProcessing || lastResult) return;

    try {
      // Decode QR from base64 string
      const image = new Image();
      image.src = base64;
      await new Promise(resolve => image.onload = resolve);

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return; // Silent fail if context missing

      ctx.drawImage(image, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        // Valid QR Code found - Start Processing
        setIsProcessing(true);
        setError(null);
        
        const accessKey = code.data.trim().toUpperCase();
        
        // Quick validate format before hitting DB to save resources
        if (!accessKey.startsWith('KK-')) {
           setError(`INVALID FORMAT: ${accessKey}`);
           audio.playClick(); // Error sound
           setIsProcessing(false);
           return;
        }

        const student = await db.getStudentByNo(accessKey);
        
        if (student) {
          try {
            await MinistryService.checkIn(student.id, username);
            audio.playYehey();
            setLastResult({ name: getFirstName(student.fullName).toUpperCase(), status: 'CHECKED-IN SUCCESS' });
          } catch (e: any) {
            setLastResult({ name: getFirstName(student.fullName).toUpperCase(), status: 'ALREADY PRESENT' });
            audio.playClick(); // Notification sound
          }
        } else {
          setError(`UNKNOWN KEY: ${accessKey}`);
          audio.playClick();
        }
        
        setIsProcessing(false);
        
        // Clear result after 3 seconds to resume scanning
        setTimeout(() => {
          setLastResult(null);
          setError(null);
        }, 3000);
      } 
      // Else: No QR code found. Do nothing. Scanner continues.
      
    } catch (err) {
      console.error("Scan error:", err);
      // Don't block UI for transient errors in auto-mode
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">QR Scanner</h2>
        <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px]">Auto-Scanning enabled (Rear Camera)</p>
      </div>

      <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-pink-50">
        <div className="max-w-md mx-auto space-y-8">
          <CameraScanner 
            onCapture={handleCapture}
            isScanning={isProcessing || !!lastResult} // Pause scanning while processing or showing result
            facingMode="environment" // Prefer rear camera
            autoCaptureInterval={500} // Scan every 500ms
            label="Scanning..."
          />

          <div className="min-h-[140px] flex flex-col items-center justify-center border-2 border-dashed border-pink-50 rounded-[2.5rem] p-8 text-center bg-gray-50/30 transition-all">
            {isProcessing && (
              <div className="animate-pulse flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-pink-500 font-black text-[10px] uppercase tracking-widest">Verifying Identity...</p>
              </div>
            )}

            {!isProcessing && lastResult && (
              <div className="animate-in zoom-in-95 duration-300">
                <div className={`w-12 h-12 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ${lastResult.status.includes('SUCCESS') ? 'bg-green-500 shadow-green-100' : 'bg-amber-400 shadow-amber-100'}`}>
                   {lastResult.status.includes('SUCCESS') ? '✓' : '!'}
                </div>
                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">{lastResult.name}</h3>
                <p className={`${lastResult.status.includes('SUCCESS') ? 'text-green-600' : 'text-amber-600'} font-black text-[10px] uppercase tracking-widest mt-1`}>
                  {lastResult.status}
                </p>
                <div className="mt-4 w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                   <div className="h-full bg-pink-500 animate-[width_3s_linear_forwards] w-full origin-left" style={{ animationName: 'shrinkWidth' }}></div>
                </div>
              </div>
            )}

            {!isProcessing && error && (
              <div className="animate-in shake duration-300">
                <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">❌</div>
                <p className="text-red-500 font-black text-[10px] uppercase tracking-widest">{error}</p>
                <button onClick={() => setError(null)} className="text-gray-400 text-[8px] font-black uppercase mt-4 underline hover:text-pink-500">
                   Dismiss
                </button>
              </div>
            )}

            {!isProcessing && !lastResult && !error && (
              <div className="space-y-2 opacity-50">
                 <div className="text-4xl animate-bounce">📷</div>
                 <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">Point camera at Access Key</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default QRScanPage;
