import type { StudioSettings } from './types';

export const DEFAULT_SETTINGS: StudioSettings = {
  voicePreset: 'baby_cute',
  effects: [],
  pitch: 1,
  speed: 1,
  volume: 1,
  fadeIn: 0,
  fadeOut: 0,
  trimStart: 0,
  trimEnd: null,
  format: 'mp3',
  denoise: true,
  normalize: true,
  backgroundVolume: 0.25,
  inputMode: 'record',
  lyricsText: '',
  songMode: false,
  songStyle: 'pop',
};

export const POLL_INTERVAL_MS = 1200;

export const ACCEPTED_AUDIO =
  'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac,.opus';
