import { motion } from 'framer-motion';
import { Download, Film } from 'lucide-react';

interface Props {
  videoUrl: string | null;
  onDownload: () => void;
  canDownload: boolean;
}

export default function VideoGenPreview({
  videoUrl,
  onDownload,
  canDownload,
}: Props) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-elevated/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <Film className="h-4 w-4 text-cyan-400" />
          Preview
        </h3>
        {canDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500"
          >
            <Download className="h-3.5 w-3.5" />
            Download MP4
          </button>
        )}
      </div>
      <motion.div className="aspect-video overflow-hidden rounded-xl bg-black/40">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-slate-500">
            Your generated video will appear here
          </div>
        )}
      </motion.div>
      <p className="mt-2 text-center text-xs text-slate-500">
        Exported videos have no watermark
      </p>
    </div>
  );
}
