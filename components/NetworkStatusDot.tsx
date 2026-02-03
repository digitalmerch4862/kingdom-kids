
import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const NetworkStatusDot: React.FC = () => {
  const status = useNetworkStatus();

  const statusConfig = {
    online: { color: 'bg-green-500', label: 'Online' },
    slow: { color: 'bg-yellow-400', label: 'Slow Connection' },
    offline: { color: 'bg-red-600', label: 'Offline' },
  };

  const { color, label } = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5 ml-1" title={label}>
      <div className={`relative flex h-2.5 w-2.5`}>
        {/* Breathing effect ring */}
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}></span>
        {/* Solid center dot */}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color} shadow-sm border border-white/20`}></span>
      </div>
    </div>
  );
};

export default NetworkStatusDot;
