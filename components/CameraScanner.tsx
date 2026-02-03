
import React, { useRef, useState, useEffect } from 'react';

interface CameraScannerProps {
  onCapture: (base64: string) => void;
  label?: string;
  isScanning?: boolean;
  facingMode?: 'user' | 'environment';
  autoCaptureInterval?: number;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ 
  onCapture, 
  label, 
  isScanning, 
  facingMode = 'user',
  autoCaptureInterval
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const setupCamera = async () => {
    setError(null);
    setPermissionDenied(false);
    stopStream();

    // Check for Secure Context (HTTPS) - Camera API requires HTTPS or Localhost
    if (
      !window.isSecureContext && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1'
    ) {
       setError("Camera Access requires HTTPS. Please use a secure connection.");
       return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API is not supported in this browser.');
      return;
    }

    try {
      // First, check if any video input devices exist at all
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoDevice = devices.some(device => device.kind === 'videoinput');
      
      if (!hasVideoDevice) {
        setError('No camera device detected. Please connect a webcam.');
        return;
      }

      // Progressive constraints: Start specific (based on facingMode prop), end generic
      const constraintOptions = [
        { video: { facingMode: { exact: facingMode } }, audio: false },
        { video: { facingMode: facingMode }, audio: false },
        { video: { facingMode: { ideal: facingMode } }, audio: false },
        { video: true, audio: false },
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }
      ];

      let lastErr: any = null;
      let successStream: MediaStream | null = null;

      for (const constraints of constraintOptions) {
        try {
          successStream = await navigator.mediaDevices.getUserMedia(constraints);
          if (successStream) break;
        } catch (err: any) {
          lastErr = err;
          // If explicitly denied, stop trying other constraints
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
             throw err;
          }
          // Continue to next constraint
        }
      }

      if (successStream) {
        handleStream(successStream);
      } else {
        throw lastErr || new Error('All camera constraints failed');
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied.');
        setPermissionDenied(true);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('Camera hardware not found or disconnected.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another application.');
      } else if (err.name === 'OverconstrainedError') {
         setError(`Camera with facing mode '${facingMode}' not found.`);
      } else {
        setError(`Camera Error: ${err.message || 'Unknown initialization error'}`);
      }
    }
  };

  const handleStream = (s: MediaStream) => {
    setStream(s);
    if (videoRef.current) {
      videoRef.current.srcObject = s;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.warn("Video play failed:", e));
      };
    }
  };

  useEffect(() => {
    setupCamera();
    return () => stopStream();
  }, [facingMode]);

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current && stream) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const videoWidth = videoRef.current.videoWidth || 640;
        const videoHeight = videoRef.current.videoHeight || 480;
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;
        
        ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
        
        const data = canvasRef.current.toDataURL('image/jpeg', 0.8);
        onCapture(data);
      }
    }
  };

  // Auto-Capture Interval Logic
  useEffect(() => {
    let intervalId: any;
    // Only auto-capture if stream is active, no error, and not currently "scanning/processing" (paused)
    if (autoCaptureInterval && stream && !error && !isScanning) {
      intervalId = setInterval(() => {
        captureFrame();
      }, autoCaptureInterval);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoCaptureInterval, stream, error, isScanning]);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-video bg-gray-900 rounded-2xl overflow-hidden border-4 border-pink-200 shadow-xl">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-gray-800">
          <span className="text-4xl animate-pulse">⚠️</span>
          <div>
            <p className="text-white font-black uppercase tracking-tight text-sm">{error}</p>
            <p className="text-gray-400 text-[9px] uppercase font-bold mt-2 leading-relaxed">
              {permissionDenied 
                ? "Please enable camera access in your browser settings (click the lock icon in address bar) and reload." 
                : "Ensure your webcam is connected and allowed."}
            </p>
          </div>
          {permissionDenied ? (
            <button 
              onClick={handleReload}
              className="bg-pink-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-pink-700 transition-all shadow-lg active:scale-95"
            >
              Reload Page
            </button>
          ) : (
            <button 
              onClick={setupCamera}
              className="bg-pink-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-pink-700 transition-all shadow-lg active:scale-95"
            >
              Retry Connection
            </button>
          )}
        </div>
      ) : (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
      )}
      
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Scanning Animation Overlay - Visible when processing or when auto-scan is active */}
      {(!error && (isScanning || autoCaptureInterval)) && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 border-4 border-pink-500/30"></div>
          {isScanning ? (
            // Busy State Animation (Pulse)
            <div className="absolute inset-0 bg-pink-500/10 animate-pulse" />
          ) : (
            // Scanning Line Animation
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-pink-400 to-transparent absolute top-0 animate-[scan_2.5s_ease-in-out_infinite] shadow-[0_0_20px_rgba(236,72,153,0.9)]" />
          )}
        </div>
      )}

      {/* Manual Capture Button - Hide if auto-scan is enabled to reduce clutter, or show minimal */}
      {!error && !autoCaptureInterval && (
        <div className="absolute bottom-6 inset-x-0 flex justify-center">
          <button 
            onClick={captureFrame}
            disabled={!stream || isScanning}
            className="bg-pink-600 hover:bg-pink-700 text-white px-10 py-4 rounded-full font-black shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-[11px]"
          >
            {isScanning ? "Processing..." : (label || "Capture Frame")}
          </button>
        </div>
      )}

      {/* Show small indicator if auto-scanning */}
      {!error && autoCaptureInterval && (
        <div className="absolute bottom-4 right-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-white text-[8px] font-black uppercase tracking-widest border border-white/10">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            Auto Scan
          </span>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CameraScanner;
