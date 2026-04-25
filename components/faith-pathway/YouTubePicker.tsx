import React, { useState } from 'react';
import { X, Plus, ExternalLink } from 'lucide-react';

const CHANNEL_URL = 'https://www.youtube.com/@thebiggeststory/videos';

interface YouTubePickerProps {
  onSelect: (video: { title: string; url: string; provider: 'youtube' }) => void;
  onClose: () => void;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) {
      return u.searchParams.get('v') ?? u.pathname.split('/').pop() ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchTitle(url: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
  if (!res.ok) throw new Error('Could not fetch video info. Check the URL.');
  const data = await res.json();
  return data.title as string;
}

const YouTubePicker: React.FC<YouTubePickerProps> = ({ onSelect, onClose }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmbed, setShowEmbed] = useState(true);

  const handleUrlChange = async (val: string) => {
    setUrl(val);
    setTitle('');
    setError(null);
    const id = extractVideoId(val.trim());
    if (!id) return;
    setFetching(true);
    try {
      const t = await fetchTitle(val.trim());
      setTitle(t);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFetching(false);
    }
  };

  const handleAdd = () => {
    if (!url.trim() || !title) return;
    onSelect({ title, url: url.trim(), provider: 'youtube' });
    onClose();
  };

  const thumbnail = (() => {
    const id = extractVideoId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  })();

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="youtube-picker-title"
        className="bg-white rounded-[40px] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-gray-100">
          <div>
            <h2 id="youtube-picker-title" className="font-black text-xl text-[#003882] uppercase tracking-tight">Add YouTube Video</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Browse the channel, copy a video URL, paste it below</p>
          </div>
          <button onClick={onClose} aria-label="Close video picker" className="text-gray-300 hover:text-red-500 transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Channel browse toggle */}
        <div className="px-8 py-3 border-b border-gray-50 flex items-center gap-3">
          <button
            onClick={() => setShowEmbed(v => !v)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#003882] hover:text-blue-800 transition-colors"
          >
            <ExternalLink size={13} />
            {showEmbed ? 'HIDE CHANNEL BROWSER' : 'BROWSE @thebiggeststory'}
          </button>
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Open in new tab ↗
          </a>
        </div>

        {/* Channel iframe */}
        {showEmbed && (
          <div className="px-8 py-4 border-b border-gray-100">
            <iframe
              src={`https://www.youtube.com/embed?listType=user_uploads&list=thebiggeststory`}
              title="@thebiggeststory channel"
              className="w-full rounded-2xl border border-gray-100"
              style={{ height: 260 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
            />
            <p className="text-[10px] text-gray-400 font-medium mt-2 text-center">
              Find a video → copy its URL from YouTube → paste below
            </p>
          </div>
        )}

        {/* URL input */}
        <div className="px-8 py-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">YouTube Video URL</label>
            <input
              aria-label="YouTube video URL"
              className="w-full bg-gray-50 rounded-2xl px-5 py-4 text-sm font-medium text-blue-600 outline-none focus:ring-2 focus:ring-[#003882]/20 transition-all"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={e => handleUrlChange(e.target.value)}
            />
          </div>

          {/* Preview */}
          {fetching && (
            <div className="flex items-center gap-3 text-xs text-gray-400 font-medium">
              <div className="w-4 h-4 border-2 border-[#003882] border-t-transparent rounded-full animate-spin" />
              Fetching video info...
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">{error}</div>
          )}

          {thumbnail && title && (
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-2xl">
              <img src={thumbnail} alt={title} className="w-24 h-14 object-cover rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-gray-800 line-clamp-2 leading-snug">{title}</p>
                <p className="text-[10px] text-gray-400 font-medium mt-1">Ready to add</p>
              </div>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={!title || fetching}
            className="w-full h-12 bg-[#003882] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-[#003882]/90 transition-all"
          >
            <Plus size={14} />
            ADD VIDEO TO LESSON
          </button>
        </div>
      </div>
    </div>
  );
};

export default YouTubePicker;
