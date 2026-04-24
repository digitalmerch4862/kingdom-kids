import React, { useRef, useState } from 'react';

interface Props {
  onFileRead: (buffer: ArrayBuffer, fileName: string) => void;
}

const FileUpload: React.FC<Props> = ({ onFileRead }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Only .xlsx files accepted');
      return;
    }
    const buf = await file.arrayBuffer();
    onFileRead(buf, file.name);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
    >
      <p className="text-lg font-semibold">Drop .xlsx file here or click to browse</p>
      {error && <p className="text-red-500 mt-3 text-sm">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
};

export default FileUpload;
