
import React from 'react';

const FaithPathwayPage: React.FC = () => {
  return (
    <div className="flex-1 w-full h-full bg-white overflow-hidden animate-in fade-in duration-500 flex flex-col">
      <iframe
        src="https://kk-faith-pathway.vercel.app/"
        title="Faith Pathway"
        className="flex-1 w-full border-none shadow-inner"
        allow="autoplay; encrypted-media; fullscreen; geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
        loading="eager"
      />
    </div>
  );
};

export default FaithPathwayPage;