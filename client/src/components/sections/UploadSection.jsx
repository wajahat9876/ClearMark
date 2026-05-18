import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Upload } from 'lucide-react';
import { getImageDimensions, isValidImageFile, readFileAsDataUrl } from '../../utils/image';
import Button from '../ui/Button';

export default function UploadSection({ onImageLoaded, hasImage }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = useCallback(
    async (file) => {
      setError(null);
      if (!isValidImageFile(file)) {
        setError('Please upload a valid image (PNG, JPG, WebP).');
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const { width, height } = await getImageDimensions(dataUrl);
        onImageLoaded(dataUrl, width, height);
      } catch {
        setError('Could not read this image. Try another file.');
      }
    },
    [onImageLoaded]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  if (hasImage) return null;

  return (
    <section id="upload" className="px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Upload your image</h2>
        <p className="mt-2 text-slate-400">
          Drag and drop or click to browse. We keep your original resolution.
        </p>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            mt-6 flex cursor-pointer flex-col items-center justify-center
            rounded-2xl border-2 border-dashed px-6 py-16 transition-all
            ${isDragging
              ? 'border-accent bg-accent/10 scale-[1.01]'
              : 'border-surface-border hover:border-accent/50 hover:bg-surface-elevated/50'}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onInputChange}
          />
          <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/20 text-accent-hover">
            {isDragging ? (
              <ImagePlus className="h-8 w-8" />
            ) : (
              <Upload className="h-8 w-8" />
            )}
          </span>
          <p className="text-lg font-medium text-slate-200">
            {isDragging ? 'Drop to upload' : 'Drag & drop your image here'}
          </p>
          <p className="mt-1 text-sm text-slate-500">or click to select a file</p>
          <Button variant="secondary" size="sm" className="mt-6 pointer-events-none">
            Choose file
          </Button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-rose-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
