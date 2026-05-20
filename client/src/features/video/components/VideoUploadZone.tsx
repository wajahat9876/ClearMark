import { motion } from 'framer-motion';
import { Film, Upload, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import Button from '../../../components/ui/Button';
import { formatFileSize } from '../utils/video';

interface VideoUploadZoneProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function VideoUploadZone({
  file,
  onFileSelect,
  onClear,
  disabled,
}: VideoUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (next: File) => {
      onFileSelect(next);
    },
    [onFileSelect]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) handleFile(dropped);
    },
    [disabled, handleFile]
  );

  if (file) {
    return (
      <div className="rounded-2xl border border-surface-border glass p-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20">
              <Film className="h-6 w-6 text-violet-300" />
            </span>
            <div>
              <p className="font-medium text-white">{file.name}</p>
              <p className="text-sm text-slate-400">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={disabled}
            aria-label="Remove video"
          >
            <X className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        flex cursor-pointer flex-col items-center justify-center rounded-2xl
        border-2 border-dashed px-6 py-14 transition-all
        ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        ${
          isDragging
            ? 'scale-[1.01] border-violet-400 bg-violet-500/10'
            : 'border-surface-border hover:border-violet-500/50 hover:bg-surface-elevated/50'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv,.avi"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15">
        <Upload className="h-7 w-7 text-violet-300" />
      </span>
      <p className="font-display text-lg font-semibold">Drop your video here</p>
      <p className="mt-2 text-center text-sm text-slate-400">
        or click to browse — MP4, WebM, MOV, MKV up to 500 MB
      </p>
    </motion.div>
  );
}
