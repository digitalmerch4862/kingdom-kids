import React, { useCallback, useRef } from 'react';
import jsQR from 'jsqr';
import CameraScanner from '../CameraScanner';

interface Props {
  onScan: (text: string) => void;
  onError?: (err: string) => void;
}

const QrReader: React.FC<Props> = ({ onScan, onError }) => {
  const lastScan = useRef<string | null>(null);
  const cooldown = useRef(false);

  const handleCapture = useCallback((base64: string) => {
    if (cooldown.current) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (result && result.data && result.data !== lastScan.current) {
        lastScan.current = result.data;
        cooldown.current = true;
        onScan(result.data);
        setTimeout(() => {
          cooldown.current = false;
          lastScan.current = null;
        }, 2000);
      }
    };
    img.onerror = () => onError?.('Failed to decode image');
    img.src = base64;
  }, [onScan, onError]);

  return (
    <CameraScanner
      onCapture={handleCapture}
      facingMode="environment"
      autoCaptureInterval={500}
    />
  );
};

export default QrReader;
