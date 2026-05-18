import { useCallback, useEffect, useState } from 'react';
import { checkHealth } from './api/inpaint';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import BeforeAfterPreview from './components/sections/BeforeAfterPreview';
import DownloadSection from './components/sections/DownloadSection';
import EditorSection from './components/sections/EditorSection';
import Hero from './components/sections/Hero';
import UploadSection from './components/sections/UploadSection';
import { useImageEditor } from './hooks/useImageEditor';

export default function HomePage() {
  const [health, setHealth] = useState(null);
  const editor = useImageEditor();

  useEffect(() => {
    const poll = () => checkHealth().then(setHealth);
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const scrollToUpload = useCallback(() => {
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleImageLoaded = useCallback(
    (dataUrl, width, height) => {
      editor.loadImage(dataUrl, width, height);
      requestAnimationFrame(() => {
        document.getElementById('editor')?.scrollIntoView({ behavior: 'smooth' });
      });
    },
    [editor]
  );

  const showOffline = health && !health.online;
  const showModelLoading = health?.online && health.modelLoading && !health.modelLoaded;
  const showLoadError = health?.online && health.loadError;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {showOffline && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200">
          AI server offline — start the backend:{' '}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-amber-100">
            cd server && source .venv/bin/activate && uvicorn main:app --reload --port 8000
          </code>
        </div>
      )}
      {showModelLoading && (
        <div className="border-b border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-center text-sm text-indigo-200">
          Downloading AI model (~200MB on first run)… Wait until the terminal shows{' '}
          <strong>SimpleLama model ready</strong>, then use Remove with AI.
        </div>
      )}
      {showLoadError && (
        <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-center text-sm text-rose-200">
          Model failed to load: {health.loadError}
        </div>
      )}
      <main className="flex-1">
        <Hero onGetStarted={scrollToUpload} />
        <UploadSection
          onImageLoaded={handleImageLoaded}
          hasImage={Boolean(editor.sourceUrl)}
        />
        <EditorSection
          sourceUrl={editor.sourceUrl}
          dimensions={editor.dimensions}
          strokes={editor.strokes}
          onStrokesChange={editor.setStrokes}
          brushSize={editor.brushSize}
          onBrushSizeChange={editor.setBrushSize}
          onUndo={editor.undoStroke}
          onClear={editor.clearMask}
          onProcess={editor.processImage}
          onReset={editor.reset}
          canProcess={editor.hasMask && health?.modelLoaded}
          isProcessing={editor.isProcessing}
          progress={editor.progress}
          error={editor.error}
        />
        <BeforeAfterPreview
          sourceUrl={editor.sourceUrl}
          resultUrl={editor.resultUrl}
        />
        <DownloadSection
          resultUrl={editor.resultUrl}
          onStartOver={editor.reset}
        />
      </main>
      <Footer />
    </div>
  );
}
