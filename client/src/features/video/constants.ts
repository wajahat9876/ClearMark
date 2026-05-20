import type { VideoResolution } from './types';

export const RESOLUTION_OPTIONS: {
  id: VideoResolution;
  label: string;
  description: string;
  pixels: string;
}[] = [
  {
    id: '2k',
    label: '2K',
    description: '1440p — ideal for YouTube & streaming',
    pixels: '2560 × 1440',
  },
  {
    id: '4k',
    label: '4K',
    description: '2160p — cinema-grade for premium content',
    pixels: '3840 × 2160',
  },
];

export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/avi',
];

export const MAX_VIDEO_MB = 500;

export const POLL_INTERVAL_MS = 1500;
