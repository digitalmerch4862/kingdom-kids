import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Play } from 'lucide-react';

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CHANNEL_HANDLE = 'thebiggeststory';

interface YTVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  url: string;
}

interface YouTubePickerProps {
  onSelect: (video: { title: string; url: string; provider: 'youtube' }) => void;
  onClose: () => void;
}

interface PlaylistItem {
  snippet: {
    title: string;
    resourceId: { videoId: string };
    thumbnails?: { medium?: { url: string }; default?: { url: string } };
  };
}

async function fetchChannelVideos(): Promise<YTVideo[]> {
  if (!API_KEY) throw new Error('VITE_GOOGLE_API_KEY is not configured');
  // Step 1: resolve channel handle → channel ID + uploads playlist
  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${CHANNEL_HANDLE}&key=${API_KEY}`
  );
  const chData = await chRes.json();
  if (!chRes.ok) throw new Error(chData?.error?.message ?? `YouTube API error ${chRes.status}`);
  if (!chData.items?.length) throw new Error('Channel not found');
  const uploadsPlaylistId: string = chData.items[0].contentDetails.relatedPlaylists.uploads;

  // Step 2: list up to 50 videos from uploads playlist
  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${API_KEY}`
  );
  const plData = await plRes.json();
  if (!plRes.ok) throw new Error(plData?.error?.message ?? `YouTube API error ${plRes.status}`);
  if (!plData.items) return [];

  return plData.items.map((item: PlaylistItem) => {
    const snippet = item.snippet;
    const videoId: string = snippet.resourceId.videoId;
    return {
      videoId,
      title: snippet.title as string,
      thumbnail: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? '',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  });
}

const YouTubePicker: React.FC<YouTubePickerProps> = ({ onSelect, onClose }) => {
  const [videos, setVideos] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const allVideos = useRef<YTVideo[]>([]);

  useEffect(() => {
    fetchChannelVideos()
      .then(v => { allVideos.current = v; setVideos(v); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? allVideos.current.filter(v => v.title.toLowerCase().includes(search.toLowerCase()))
    : videos;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-[40px] w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-black text-xl text-[#003882] uppercase tracking-tight">Browse @thebiggeststory</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Select a video to attach to this lesson</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-300 hover:text-red-500 transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Search */}
        <div className="px-8 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm outline-none font-medium text-gray-700 placeholder:text-gray-400"
              placeholder="Search videos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-3">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#003882] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 font-medium py-12">No videos found</p>
          )}
          {filtered.map(v => (
            <button
              key={v.videoId}
              onClick={() => { onSelect({ title: v.title, url: v.url, provider: 'youtube' }); onClose(); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-blue-50 transition-colors text-left group"
            >
              <div className="relative shrink-0">
                <img src={v.thumbnail} alt={v.title} className="w-28 h-16 object-cover rounded-xl" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play size={20} className="text-white fill-white" />
                </div>
              </div>
              <span className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug">{v.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default YouTubePicker;
