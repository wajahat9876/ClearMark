import { motion } from 'framer-motion';
import { VOICE_OPTIONS } from '../constants';
import type { VoiceId } from '../types';
import VoiceCard from './VoiceCard';

interface VoiceSelectorProps {
  selectedVoice: VoiceId;
  onSelect: (id: VoiceId) => void;
}

export default function VoiceSelector({
  selectedVoice,
  onSelect,
}: VoiceSelectorProps) {
  return (
    <section className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between gap-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="font-display text-xl font-bold text-slate-100">
            Choose a voice
          </h2>
          <p className="text-sm text-slate-400">
            8 AI voice styles — free Edge TTS (no API key needed)
          </p>
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {VOICE_OPTIONS.map((voice) => (
          <VoiceCard
            key={voice.id}
            voice={voice}
            selected={selectedVoice === voice.id}
            onSelect={() => onSelect(voice.id)}
          />
        ))}
      </motion.div>
    </section>
  );
}
