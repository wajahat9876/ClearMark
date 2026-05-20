export type VideoStyleId =
  | 'cinematic'
  | 'cartoon'
  | 'pixar'
  | 'anime'
  | 'realistic'
  | 'fantasy'
  | 'kids'
  | 'action';

export type AspectRatioId = '16:9' | '9:16' | '1:1';

export type QualityId = '720p' | '1080p' | '2k' | '4k';

export type FpsId = 24 | 30 | 60;

export interface PresetItem {
  id: string;
  label: string;
}

export interface VideoGenSettings {
  prompt: string;
  style: VideoStyleId;
  aspectRatio: AspectRatioId;
  quality: QualityId;
  duration: number;
  fps: FpsId;
  transitionDuration: number;
}

export interface VideoGenHealthResponse {
  status: string;
  ffmpeg?: boolean;
  ffprobe?: boolean;
  opencv?: boolean;
  aiMode?: string;
  aiConfigured?: boolean;
  hfAvailable?: boolean;
  svdAvailable?: boolean;
  backends?: string[];
  gpu?: boolean;
  motionFallback?: boolean;
  hfTokenSet?: boolean;
  falKeySet?: boolean;
  styles?: PresetItem[];
  aspectRatios?: string[];
  qualities?: string[];
  unreachable?: boolean;
}

export interface VideoGenJobResponse {
  jobId: string;
  status: string;
  progress: number;
  message: string;
  error?: string | null;
}

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
}
