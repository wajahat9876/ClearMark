import { Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface AudioUploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export default function AudioUploadZone({ onFile, disabled }: AudioUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = useCallback(
    (file: File) => {
      if (file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|webm|flac)$/i.test(file.name)) {
        onFile(file);
      }
    },
    [onFile]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handle(f);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-4 py-8 transition ${
        dragging
          ? 'border-cyan-400 bg-cyan-500/10'
          : 'border-surface-border hover:border-cyan-500/40'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = '';
        }}
      />
      <Upload className="mb-2 h-8 w-8 text-cyan-400" />
      <p className="text-sm font-medium">Drop audio or click to upload</p>
      <p className="mt-1 text-xs text-slate-500">MP3, WAV, WebM, M4A</p>
    </div>
  );
}
