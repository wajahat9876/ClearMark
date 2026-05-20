import { ACCEPTED_VIDEO_TYPES, MAX_VIDEO_MB } from '../constants';

export function isValidVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  if (ACCEPTED_VIDEO_TYPES.includes(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'].includes(ext ?? '');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateVideoFile(file: File): string | null {
  if (!isValidVideoFile(file)) {
    return 'Please upload MP4, WebM, MOV, MKV, or AVI.';
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_VIDEO_MB) {
    return `Video must be under ${MAX_VIDEO_MB} MB.`;
  }
  return null;
}

export function createVideoObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeVideoObjectUrl(url: string | null): void {
  if (url) URL.revokeObjectURL(url);
}
