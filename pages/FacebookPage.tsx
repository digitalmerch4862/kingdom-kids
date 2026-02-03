
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Facebook, ExternalLink, Loader2, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';

const FacebookPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [key, setKey] = useState(0); // Used to force re-render of the plugin
  
  // Default dimensions
  const [containerWidth, setContainerWidth] = useState(500);
  const [containerHeight, setContainerHeight] = useState(800);

  // --- SMART DEEP LINKING ---
  const openNativeApp = () => {
    const pageUrl = "https://www.facebook.com/JLYCCKingdomKids/";
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      window.location.href = `fb://facewebmodal/f?href=${pageUrl}`;
      setTimeout(() => { window.open(pageUrl, '_blank'); }, 500);
    } else {
      window.open(pageUrl, '_blank');
    }
  };

  // --- CORE FACEBOOK LOADER ---
  const loadFacebookSDK = useCallback(() => {
    setIsLoading(true);
    setHasError(false);

    // 1. Helper to parse the feed once SDK is ready
    const parseXFBML = () => {
      if (window.FB && containerRef.current) {
        try {
          window.FB.XFBML.parse(containerRef.current);
          setIsLoading(false);
        } catch (e) {
          console.error("Parse error:", e);
        }
      }
    };

    // 2. Check if SDK is already loaded
    if (window.FB) {
      parseXFBML();
      return;
    }

    // 3. Setup Async Init (if not already set)
    if (!window.fbAsyncInit) {
      // @ts-ignore
      window.fbAsyncInit = function() {
        // @ts-ignore
        window.FB.init({ xfbml: true, version: 'v18.0' });
        parseXFBML();
      };
    }

    // 4. Inject Script (if not exists)
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => {
        console.error("Script load blocked (AdBlocker?)");
        setHasError(true);
        setIsLoading(false);
      };
      document.body.appendChild(script);
    }
  }, []);

  // --- INITIALIZATION ---
  useEffect(() => {
    // Calculate Dimensions
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const safeWidth = Math.min(Math.max(width, 180), 500);
        // On mobile, take up most of the screen minus header
        const availableHeight = window.innerHeight - 200; 
        const safeHeight = Math.max(availableHeight, 500);

        setContainerWidth(safeWidth);
        setContainerHeight(safeHeight);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    // Start Loading
    loadFacebookSDK();

    // Timeout Fallback (15 seconds)
    const safetyTimer = setTimeout(() => {
      setIsLoading((current) => {
        if (current) {
          setHasError(true);
          return false;
        }
        return current;
      });
    }, 15000);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(safetyTimer);
    };
  }, [loadFacebookSDK]);

  // --- RETRY HANDLER ---
  const handleRetry = () => {
    setKey(prev => prev + 1); // Force React to destroy and recreate the DOM node
    setTimeout(() => {
      loadFacebookSDK();
    }, 100);
  };

  return (
    <div className="bg-[#141414] min-h-[calc(100vh-6rem)] rounded-[1.5rem] md:rounded-[2.5rem] p-3 md:p-8 text-white shadow-2xl relative overflow-hidden animate-in fade-in duration-500 flex flex-col items-center">
      
      {/* Header */}
      <div className="w-full flex flex-col md:flex-row items-center justify-between mb-6 gap-4 max-w-2xl text-center md:text-left">
        <div className="flex items-center gap-3">
          <div className="bg-[#1877F2] p-2 rounded-lg shadow-lg shadow-blue-900/20">
            <Facebook size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">Community Feed</h1>
            <p className="hidden md:block text-xs text-gray-400 font-medium tracking-wider">LATEST UPDATES FROM KINGDOM KIDS</p>
          </div>
        </div>
        
        <button 
          onClick={openNativeApp}
          className="w-full md:w-auto flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest bg-[#202020] border border-gray-700 hover:border-white px-6 py-4 rounded-xl transition-all hover:bg-white hover:text-black active:scale-95 shadow-lg"
        >
          <Smartphone size={14} /> Click here and follow us
        </button>
      </div>

      {/* Main Feed Container */}
      <div 
        ref={containerRef}
        className="w-full max-w-[500px] flex-1 bg-white rounded-xl overflow-hidden relative border border-gray-800 shadow-inner min-h-[500px]"
      >
        {/* Loading State */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#202020] gap-4">
            <Loader2 className="animate-spin text-pink-500" size={32} />
            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest animate-pulse">Connecting to Facebook...</p>
          </div>
        )}

        {/* Error / AdBlock State */}
        {hasError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#202020] p-6 text-center space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-red-500/10 p-4 rounded-full">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <h3 className="font-bold text-white text-lg">Connection Blocked</h3>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
              Your browser or network is blocking the Facebook feed. Please disable "Ad Blocker" or "Shields" for this site.
            </p>
            
            <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
              <button 
                onClick={handleRetry}
                className="w-full bg-white text-black px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Retry Connection
              </button>
              
              <button 
                onClick={openNativeApp}
                className="w-full bg-[#1877F2] text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1864cc] transition-all flex items-center justify-center gap-2 shadow-xl"
              >
                Click here and follow us <ExternalLink size={14} />
              </button>
            </div>
          </div>
        )}

        {/* The Actual Facebook Plugin */}
        {/* We use 'key' to force React to wipe this div and start fresh on Retry */}
        <div key={`${key}-${containerWidth}`} className="w-full h-full bg-white overflow-y-auto" style={{WebkitOverflowScrolling: 'touch'}}>
          {!hasError && (
            <div 
              className="fb-page" 
              data-href="https://www.facebook.com/JLYCCKingdomKids/" 
              data-tabs="timeline,events" 
              data-width={containerWidth}
              data-height={containerHeight}
              data-small-header="true" 
              data-adapt-container-width="false" 
              data-hide-cover="false" 
              data-show-facepile="false"
            >
              <blockquote cite="https://www.facebook.com/JLYCCKingdomKids/" className="fb-xfbml-parse-ignore">
                <a href="https://www.facebook.com/JLYCCKingdomKids/">Kingdom Kids</a>
              </blockquote>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

export default FacebookPage;
