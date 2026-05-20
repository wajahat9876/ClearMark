import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import Button from '../../../components/ui/Button';

interface EnhanceButtonProps {
  onEnhance: () => void;
  disabled?: boolean;
  isEnhancing?: boolean;
}

export default function EnhanceButton({
  onEnhance,
  disabled,
  isEnhancing,
}: EnhanceButtonProps) {
  return (
    <Button
      size="lg"
      className="voice-generate-btn w-full justify-center bg-gradient-to-r from-violet-600 to-indigo-600 py-4 text-base font-semibold shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500"
      onClick={onEnhance}
      disabled={disabled || isEnhancing}
    >
      {isEnhancing ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Enhancing…
        </>
      ) : (
        <>
          <Wand2 className="h-5 w-5" />
          Enhance Video Quality
          <Sparkles className="h-4 w-4 opacity-80" />
        </>
      )}
    </Button>
  );
}
