export type VoiceId =
  | 'baby'
  | 'boy'
  | 'girl'
  | 'man'
  | 'woman'
  | 'old_man'
  | 'old_woman'
  | 'robot';

export type EmotionId = 'happy' | 'sad' | 'excited' | 'calm' | 'angry';

export type LanguageId =
  | 'en-US'
  | 'en-GB'
  | 'es-ES'
  | 'fr-FR'
  | 'de-DE'
  | 'it-IT'
  | 'pt-BR'
  | 'ja-JP';

export interface VoiceOption {
  id: VoiceId;
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

export interface VoiceGenerationSettings {
  speed: number;
  pitch: number;
  emotion: EmotionId;
  language: LanguageId;
  aiEnhancement: boolean;
  backgroundMusic: boolean;
}

export interface GenerationRecord {
  id: string;
  text: string;
  voiceId: VoiceId;
  audioUrl: string;
  createdAt: number;
  settings: VoiceGenerationSettings;
}

export interface TTSGenerateRequest {
  text: string;
  voiceId: VoiceId;
  speed: number;
  pitch: number;
  emotion: EmotionId;
  language: LanguageId;
  aiEnhancement: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
