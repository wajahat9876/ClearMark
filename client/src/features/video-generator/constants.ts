import type { VideoGenSettings } from './types';

export const MAX_IMAGES = 12;
export const MAX_IMAGE_MB = 15;
export const POLL_INTERVAL_MS = 1500;

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
];

export const DEFAULT_SETTINGS: VideoGenSettings = {
  prompt: '',
  style: 'cinematic',
  aspectRatio: '9:16',
  quality: '1080p',
  duration: 8,
  fps: 30,
  transitionDuration: 0.5,
};

export const STYLE_OPTIONS = [
  { id: 'cinematic', label: 'Cinematic', emoji: '🎬' },
  { id: 'cartoon', label: 'Cartoon', emoji: '🎨' },
  { id: 'pixar', label: 'Pixar-style', emoji: '✨' },
  { id: 'anime', label: 'Anime', emoji: '⚡' },
  { id: 'realistic', label: 'Realistic', emoji: '📷' },
  { id: 'fantasy', label: 'Fantasy', emoji: '🧙' },
  { id: 'kids', label: 'Kids Story', emoji: '🧸' },
  { id: 'action', label: 'Action Scene', emoji: '💥' },
] as const;

export const ASPECT_OPTIONS = [
  { id: '16:9', label: 'YouTube', sub: '16:9' },
  { id: '9:16', label: 'Shorts / Reels', sub: '9:16' },
  { id: '1:1', label: 'Square', sub: '1:1' },
] as const;

export const DURATION_OPTIONS = [5, 8, 12, 15, 20, 30] as const;

export const QUALITY_OPTIONS = [
  { id: '720p', label: 'HD 720p' },
  { id: '1080p', label: 'Full HD' },
  { id: '2k', label: '2K' },
  { id: '4k', label: '4K' },
] as const;

export const FPS_OPTIONS = [
  { id: 24, label: '24 fps (film)' },
  { id: 30, label: '30 fps' },
  { id: 60, label: '60 fps (smooth)' },
] as const;
