import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  Moon,
  Music,
  Sparkles,
  Sun,
  Wand2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import ProgressBar from '../../../components/ui/ProgressBar';
import { useTheme } from '../../../contexts/ThemeContext';
import { checkStudioHealth, fetchPresets } from '../api/studio';
import AudioControlsPanel from '../components/AudioControlsPanel';
import AudioUploadZone from '../components/AudioUploadZone';
import InputModeTabs from '../components/InputModeTabs';
import LyricsPanel from '../components/LyricsPanel';
import PresetGrid from '../components/PresetGrid';
import RecordPanel from '../components/RecordPanel';
import { useVoiceStudio } from '../hooks/useVoiceStudio';
import type { SongStyle } from '../types';

const NEURAL_PRESETS = [
  'baby_cute',
  'baby_girl',
  'child_2yo',
  'female_neural',
  'female_soft',
  'female_bright',
];

export default function VoiceStudioScreen() {
  const { theme, toggleTheme } = useTheme();
  const studio = useVoiceStudio();
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    checkStudioHealth()
      .then((h) => setServerOk(h.ffmpeg === true))
      .catch(() => setServerOk(false));
    fetchPresets()
      .then((p) => {
        studio.setVoicePresets(p.voicePresets);
        studio.setEmotionEffects(p.emotionEffects);
        if (p.songStyles?.length) studio.setSongStyles(p.songStyles);
      })
      .catch(() => {
        studio.setVoicePresets([
          { id: 'baby_cute', label: 'Baby Girl Voice', category: 'voice' },
          { id: 'female_neural', label: 'Female (Natural)', category: 'voice' },
          { id: 'female_soft', label: 'Soft Female', category: 'voice' },
        ]);
        studio.setEmotionEffects([
          { id: 'laughing', label: 'Laughing', category: 'emotion' },
        ]);
        studio.setSongStyles([
          { id: 'pop', label: 'Pop', category: 'song' },
          { id: 'lullaby', label: 'Lullaby', category: 'song' },
          { id: 'acoustic', label: 'Acoustic', category: 'song' },
        ]);
      });
  }, []);

  const handleProcess = useCallback(async () => {
    await studio.process();
  }, [studio]);

  return (
    <motion.div
      className="studio-page min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="studio-ambient pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-40 border-b border-surface-border/60 glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-fuchsia-600 shadow-lg shadow-cyan-500/30">
              <Sparkles className="h-4 w-4 text-white" />
            </span>
            AI Voice Studio
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl glass p-2.5 text-slate-300 hover:text-white"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-10 text-center">
          <p className="mb-2 text-sm text-cyan-300/90">Record · Transform · Export</p>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
            <span className="gradient-text">AI Voice Studio</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            Record or type lyrics, pick a royalty-free baby or female neural voice,
            and turn your words into a song. No watermarks on exports.
          </p>
        </div>

        {serverOk === false && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-200">
            Start the API (<code className="rounded bg-black/30 px-1">npm run server</code>
            ) — FFmpeg required.
          </div>
        )}

        {studio.error && (
          <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
            {studio.error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <InputModeTabs
              mode={studio.settings.inputMode}
              onChange={(inputMode) => studio.updateSettings({ inputMode })}
              disabled={studio.isProcessing}
            />
            {studio.settings.inputMode === 'record' ? (
              <>
                <RecordPanel
                  disabled={studio.isProcessing}
                  onRecorded={(blob) => studio.setAudio(blob, 'recording.webm')}
                />
                <AudioUploadZone
                  disabled={studio.isProcessing}
                  onFile={(f) => studio.setAudio(f, f.name)}
                />
                {studio.sourceUrl && (
                  <div className="glass rounded-2xl p-4">
                    <p className="mb-2 text-xs text-slate-500">Source preview</p>
                    <audio src={studio.sourceUrl} controls className="w-full" />
                    <button
                      type="button"
                      onClick={studio.clearAudio}
                      className="mt-2 text-xs text-slate-500 hover:text-white"
                    >
                      Clear audio
                    </button>
                  </div>
                )}
              </>
            ) : (
              <LyricsPanel
                value={studio.settings.lyricsText}
                onChange={(lyricsText) => studio.updateSettings({ lyricsText })}
                disabled={studio.isProcessing}
              />
            )}
          </div>

          <div className="space-y-4">
            <PresetGrid
              title="AI voice presets"
              items={studio.voicePresets}
              selectedId={studio.settings.voicePreset}
              onSelect={(id) => studio.updateSettings({ voicePreset: id })}
              disabled={studio.isProcessing}
            />
            {NEURAL_PRESETS.includes(studio.settings.voicePreset) && (
              <p className="text-center text-xs text-violet-300/90">
                Uses royalty-free Microsoft neural voices (AnaNeural baby, JennyNeural /
                AriaNeural female). Your words are re-spoken naturally — or sung in song mode.
              </p>
            )}
            <div className="glass voice-panel space-y-3 rounded-2xl p-5">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={studio.settings.songMode}
                  disabled={studio.isProcessing}
                  onChange={(e) => studio.updateSettings({ songMode: e.target.checked })}
                  className="h-4 w-4 rounded border-surface-border"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <Music className="h-4 w-4 text-fuchsia-400" />
                  Turn lyrics into a song
                </span>
              </label>
              <p className="text-xs text-slate-500">
                Adds singing-style vibrato and a royalty-free instrumental backing track.
              </p>
              {studio.settings.songMode && studio.songStyles.length > 0 && (
                <PresetGrid
                  title="Song style"
                  items={studio.songStyles}
                  selectedId={studio.settings.songStyle}
                  onSelect={(id) =>
                    studio.updateSettings({ songStyle: id as SongStyle })
                  }
                  disabled={studio.isProcessing}
                />
              )}
            </div>
            <PresetGrid
              title="Emotional & fun effects"
              items={studio.emotionEffects}
              selectedIds={studio.settings.effects}
              multi
              onSelect={studio.toggleEffect}
              disabled={studio.isProcessing}
            />
            {studio.settings.effects.length > 0 && (
              <p className="text-center text-xs text-cyan-400/90">
                Selected: {studio.settings.effects.join(', ')}
              </p>
            )}
            <AudioControlsPanel
              settings={studio.settings}
              onChange={studio.updateSettings}
              onBackgroundFile={studio.setBackgroundFile}
              disabled={studio.isProcessing}
            />
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-cyan-600 to-fuchsia-600 py-4 shadow-lg shadow-cyan-500/25"
              disabled={!studio.canProcess || serverOk === false}
              onClick={handleProcess}
            >
              <Wand2 className="h-5 w-5" />
              {studio.settings.songMode ? 'Create song & export' : 'Apply voice & export'}
            </Button>
            {studio.isProcessing && (
              <ProgressBar
                value={studio.progress}
                label={studio.statusMessage || 'Processing…'}
              />
            )}
            {studio.outputUrl && (
              <div className="glass rounded-2xl p-4">
                <p className="mb-2 text-xs font-medium text-emerald-400">
                  Enhanced preview
                </p>
                <audio src={studio.outputUrl} controls className="w-full" />
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={studio.download}
                  disabled={!studio.canDownload}
                >
                  <Download className="h-4 w-4" />
                  Download {studio.settings.format.toUpperCase()}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </motion.div>
  );
}
