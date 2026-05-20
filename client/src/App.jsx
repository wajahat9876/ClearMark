import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import HomePage from './HomePage';

const VoiceGeneratorScreen = lazy(
  () => import('./features/voice/screens/VoiceGeneratorScreen')
);
const VideoEnhanceScreen = lazy(
  () => import('./features/video/screens/VideoEnhanceScreen')
);
const VoiceStudioScreen = lazy(
  () => import('./features/voice-studio/screens/VoiceStudioScreen')
);
const VideoGeneratorScreen = lazy(
  () => import('./features/video-generator/screens/VideoGeneratorScreen')
);

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/voice-generator" element={<VoiceGeneratorScreen />} />
            <Route path="/video-enhance" element={<VideoEnhanceScreen />} />
            <Route path="/voice-studio" element={<VoiceStudioScreen />} />
            <Route path="/video-generator" element={<VideoGeneratorScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
