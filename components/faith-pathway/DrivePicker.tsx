import React, { useState, useEffect } from 'react';
import { X, Search, FileText, Image, Film, Music, File } from 'lucide-react';

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const FOLDER_ID = '1YM_d97MsRVlNXJGJzVrEEucwtXhPIMQh';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
}

interface DrivePickerProps {
  onSelect: (file: { name: string; storage_path: string }) => void;
  onClose: () => void;
}

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image size={18} className="text-green-500" />;
  if (mimeType.startsWith('video/')) return <Film size={18} className="text-purple-500" />;
  if (mimeType.startsWith('audio/')) return <Music size={18} className="text-yellow-500" />;
  if (mimeType === 'application/pdf') return <FileText size={18} className="text-red-500" />;
  return <File size={18} className="text-gray-400" />;
}

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return null; }
}

async function fetchDriveFiles(): Promise<DriveFile[]> {
  if (!API_KEY) throw new Error('VITE_GOOGLE_API_KEY is not configured');
  const url = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&fields=files(id,name,mimeType,webViewLink)&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await safeJson(res) as any;
  if (!res.ok) throw new Error(data?.error?.message ?? `Drive API error ${res.status}`);
  if (data?.error) throw new Error(data.error.message);
  return (data?.files ?? []) as DriveFile[];
}

const DrivePicker: React.FC<DrivePickerProps> = ({ onSelect, onClose }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDriveFiles()
      .then(setFiles)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drive-picker-title"
        className="bg-white rounded-[40px] w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-gray-100">
          <div>
            <h2 id="drive-picker-title" className="font-black text-xl text-[#EF4E92] uppercase tracking-tight">Browse Printables</h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Select a file to attach to this lesson</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close printables picker"
            className="text-gray-300 hover:text-red-500 transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* Search */}
        <div className="px-8 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              aria-label="Search files"
              className="flex-1 bg-transparent text-sm outline-none font-medium text-gray-700 placeholder:text-gray-400"
              placeholder="Search files..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-2">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#EF4E92] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 font-medium py-12">No files found</p>
          )}
          {filtered.map(f => (
            <button
              key={f.id}
              onClick={() => { onSelect({ name: f.name, storage_path: f.webViewLink }); onClose(); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl hover:bg-pink-50 transition-colors text-left"
            >
              <span className="shrink-0">{getMimeIcon(f.mimeType)}</span>
              <span className="text-sm font-bold text-gray-800 truncate">{f.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DrivePicker;
