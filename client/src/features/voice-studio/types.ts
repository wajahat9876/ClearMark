export type ExportFormat = 'mp3' | 'wav' | 'aac';

export type StudioJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type InputMode = 'record' | 'lyrics';

export type SongStyle = 'pop' | 'lullaby' | 'acoustic';

export interface PresetItem {
  id: string;
  label: string;
  category: string;
}

export interface StudioSettings {
  voicePreset: string;
  effects: string[];
  pitch: number;
  speed: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  trimStart: number;
  trimEnd: number | null;
  format: ExportFormat;
  denoise: boolean;
  normalize: boolean;
  backgroundVolume: number;
  inputMode: InputMode;
  lyricsText: string;
  songMode: boolean;
  songStyle: SongStyle;
}

export interface StudioJobResponse {
  jobId: string;
  status: StudioJobStatus;
  progress: number;
  message: string;
  error?: string | null;
  format?: string;
}

export interface StudioHealthResponse {
  status: string;
  ffmpeg: boolean;
  unreachable?: boolean;
}
