import type { EmotionId, LanguageId, VoiceOption } from './types';

export const MAX_TEXT_LENGTH = 2000;

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'baby',
    title: 'Baby',
    description: 'Soft, playful infant tone',
    icon: '👶',
    gradient: 'from-pink-400 to-rose-500',
  },
  {
    id: 'boy',
    title: 'Boy',
    description: 'Bright youthful male voice',
    icon: '👦',
    gradient: 'from-sky-400 to-blue-500',
  },
  {
    id: 'girl',
    title: 'Girl',
    description: 'Warm, clear youthful tone',
    icon: '👧',
    gradient: 'from-fuchsia-400 to-purple-500',
  },
  {
    id: 'man',
    title: 'Man',
    description: 'Deep, confident adult male',
    icon: '👨',
    gradient: 'from-indigo-400 to-violet-600',
  },
  {
    id: 'woman',
    title: 'Woman',
    description: 'Natural, expressive female voice',
    icon: '👩',
    gradient: 'from-violet-400 to-indigo-500',
  },
  {
    id: 'old_man',
    title: 'Old Man',
    description: 'Wise, mellow senior male',
    icon: '👴',
    gradient: 'from-amber-400 to-orange-600',
  },
  {
    id: 'old_woman',
    title: 'Old Woman',
    description: 'Gentle, warm senior female',
    icon: '👵',
    gradient: 'from-teal-400 to-emerald-600',
  },
  {
    id: 'robot',
    title: 'Robot',
    description: 'Synthetic sci-fi android',
    icon: '🤖',
    gradient: 'from-cyan-400 to-slate-500',
  },
];

export const EMOTIONS: { id: EmotionId; label: string; emoji: string }[] = [
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'sad', label: 'Sad', emoji: '😢' },
  { id: 'excited', label: 'Excited', emoji: '🤩' },
  { id: 'calm', label: 'Calm', emoji: '😌' },
  { id: 'angry', label: 'Angry', emoji: '😠' },
];

export const LANGUAGES: { id: LanguageId; label: string }[] = [
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'es-ES', label: 'Spanish' },
  { id: 'fr-FR', label: 'French' },
  { id: 'de-DE', label: 'German' },
  { id: 'it-IT', label: 'Italian' },
  { id: 'pt-BR', label: 'Portuguese (BR)' },
  { id: 'ja-JP', label: 'Japanese' },
  { id: 'ur-PK', label: 'Urdu (Pakistan)' },
];

export const HISTORY_STORAGE_KEY = 'clearmark-voice-history-v1';

export const DEFAULT_SETTINGS = {
  speed: 1,
  pitch: 1,
  emotion: 'calm' as EmotionId,
  language: 'en-US' as LanguageId,
  aiEnhancement: false,
  backgroundMusic: false,
};
