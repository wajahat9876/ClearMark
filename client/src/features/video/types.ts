export type VideoResolution = '2k' | '4k';

export type VideoJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface VideoJobResponse {
  jobId: string;
  status: VideoJobStatus;
  progress: number;
  message: string;
  error?: string | null;
  retries?: number;
}

export interface VideoHealthResponse {
  status: string;
  ffmpeg: boolean;
  ffprobe?: boolean;
  ffmpeg_path?: string | null;
  ffprobe_path?: string | null;
  realesrgan?: boolean;
  gpu?: boolean;
  device?: string;
  max_upload_mb?: number;
  enhance_mode?: 'fast' | 'ai' | string;
  /** Set when the health request failed (API unreachable), not when FFmpeg is missing */
  unreachable?: boolean;
}
