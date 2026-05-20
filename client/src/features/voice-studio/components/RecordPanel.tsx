import { motion } from 'framer-motion';
import { Mic, Pause, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import WaveformVisualizer from './WaveformVisualizer';

interface RecordPanelProps {
  onRecorded: (blob: Blob) => void;
  disabled?: boolean;
}

export default function RecordPanel({ onRecorded, disabled }: RecordPanelProps) {
  const [levels, setLevels] = useState<number[]>([]);
  const recorder = useAudioRecorder(setLevels);

  useEffect(() => {
    if (!recorder.isRecording || recorder.isPaused) return;
    const id = setInterval(recorder.tickDuration, 200);
    return () => clearInterval(id);
  }, [recorder.isRecording, recorder.isPaused, recorder.tickDuration]);

  const handleStop = async () => {
    const blob = await recorder.stop();
    if (blob && blob.size > 0) onRecorded(blob);
    setLevels([]);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass voice-panel rounded-2xl p-5">
      <p className="mb-3 text-sm font-medium text-slate-300">Record voice</p>
      <WaveformVisualizer
        levels={levels}
        active={recorder.isRecording && !recorder.isPaused}
      />
      <p className="mt-2 text-center font-mono text-lg text-cyan-300">
        {formatTime(recorder.duration)}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        {!recorder.isRecording ? (
          <Button
            onClick={() => recorder.start().catch(() => alert('Microphone access denied'))}
            disabled={disabled}
            className="bg-gradient-to-r from-rose-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/30"
          >
            <Mic className="h-5 w-5" />
            Start recording
          </Button>
        ) : (
          <>
            {recorder.isPaused ? (
              <Button variant="secondary" onClick={recorder.resume}>
                <Play className="h-4 w-4" />
                Resume
              </Button>
            ) : (
              <Button variant="secondary" onClick={recorder.pause}>
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}
            <Button variant="danger" onClick={handleStop}>
              <Square className="h-4 w-4 fill-current" />
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
