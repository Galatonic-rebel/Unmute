import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

interface TranscriptionBoxProps {
  finalResult: string;
  interimResult: string;
}

export function TranscriptionBox({ finalResult, interimResult }: TranscriptionBoxProps) {
  const hasContent = finalResult || interimResult;

  return (
    <div
      className="rounded-2xl p-5 md:p-6 relative overflow-hidden min-h-[120px] flex flex-col bg-black/30 backdrop-blur-xl border border-white/10"
      data-testid="transcription-box"
    >
      <div className="flex items-center gap-2.5 mb-3 text-white/35">
        <Quote className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-widest">Live Transcript</span>
      </div>

      <div className="flex-1 text-base md:text-lg leading-relaxed font-medium">
        {!hasContent ? (
          <span className="text-white/25 italic" data-testid="transcript-placeholder">
            Transcription will appear here...
          </span>
        ) : (
          <p>
            <span className="text-white/90" data-testid="transcript-final">{finalResult}</span>
            {finalResult && interimResult && <span> </span>}
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-white/40 italic"
              data-testid="transcript-interim"
            >
              {interimResult}
            </motion.span>
          </p>
        )}
      </div>
    </div>
  );
}
