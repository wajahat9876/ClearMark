import { motion } from 'framer-motion';
import { ImagePlus, X } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { MAX_IMAGES } from '../constants';
import type { UploadedImage } from '../types';

interface Props {
  images: UploadedImage[];
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export default function ImageUploadZone({
  images,
  onAdd,
  onRemove,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      if (e.dataTransfer.files?.length) onAdd(e.dataTransfer.files);
    },
    [disabled, onAdd]
  );

  return (
    <motion.div
      className="rounded-2xl border-2 border-dashed border-surface-border bg-surface-elevated/40 p-6"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={disabled || images.length >= MAX_IMAGES}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-3 rounded-xl py-8 text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
          <ImagePlus className="h-7 w-7 text-cyan-400" />
        </span>
        <span className="font-medium text-white">Drop images or click to upload</span>
        <span className="text-sm">
          Up to {MAX_IMAGES} images · JPEG, PNG, WebP · Your content stays yours
        </span>
      </button>

      {images.length > 0 && (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => (
            <li key={img.id} className="group relative aspect-square overflow-hidden rounded-xl">
              <img
                src={img.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(img.id)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
