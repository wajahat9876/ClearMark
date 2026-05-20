import { Download } from 'lucide-react';
import Button from '../../../components/ui/Button';

interface VideoPreviewCompareProps {
  originalUrl: string | null;
  enhancedUrl: string | null;
  onDownload?: () => void;
  canDownload?: boolean;
}

export default function VideoPreviewCompare({
  originalUrl,
  enhancedUrl,
  onDownload,
  canDownload,
}: VideoPreviewCompareProps) {
  if (!originalUrl && !enhancedUrl) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-surface-border glass p-8 text-center text-sm text-slate-500">
        Upload a video to see before &amp; after previews
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Original
          </p>
          <div className="overflow-hidden rounded-xl border border-surface-border bg-black/40">
            {originalUrl ? (
              <video
                src={originalUrl}
                controls
                playsInline
                className="aspect-video w-full object-contain"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-slate-600">
                —
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Enhanced
          </p>
          <div className="overflow-hidden rounded-xl border border-violet-500/30 bg-black/40 ring-1 ring-violet-500/20">
            {enhancedUrl ? (
              <video
                src={enhancedUrl}
                controls
                playsInline
                className="aspect-video w-full object-contain"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-sm text-slate-500">
                Enhanced preview appears here
              </div>
            )}
          </div>
        </div>
      </div>
      {canDownload && onDownload && (
        <Button
          variant="secondary"
          size="md"
          className="w-full sm:w-auto"
          onClick={onDownload}
        >
          <Download className="h-4 w-4" />
          Download enhanced video
        </Button>
      )}
    </div>
  );
}
