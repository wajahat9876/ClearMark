import { Download, RefreshCw } from 'lucide-react';
import { downloadDataUrl } from '../../utils/image';
import Button from '../ui/Button';

export default function DownloadSection({ resultUrl, onStartOver }) {
  if (!resultUrl) return null;

  const handleDownload = () => {
    downloadDataUrl(resultUrl, `clearmark-${Date.now()}.png`);
  };

  return (
    <section id="download" className="px-4 pb-20 pt-4 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-2xl glass p-8 text-center">
        <h2 className="font-display text-2xl font-bold">Your image is ready</h2>
        <p className="mt-2 text-slate-400">
          Download a lossless PNG at the original resolution.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={handleDownload}>
            <Download className="h-5 w-5" />
            Download cleaned image
          </Button>
          <Button variant="secondary" size="lg" onClick={onStartOver}>
            <RefreshCw className="h-5 w-5" />
            Process another image
          </Button>
        </div>
      </div>
    </section>
  );
}
