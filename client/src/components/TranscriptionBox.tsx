import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

interface TranscriptionBoxProps {
  finalResult: string;
  interimResult: string;
}

export function TranscriptionBox({ finalResult, interimResult }: TranscriptionBoxProps) {
  const hasContent = finalResult || interimResult;

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden min-h-[160px] flex flex-col">
      <div className="flex items-center gap-3 mb-4 opacity-50">
        <Quote className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium uppercase tracking-widest">Live Transcript</span>
      </div>
      
      <div className="flex-1 text-lg md:text-xl leading-relaxed font-medium">
        {!hasContent ? (
          <span className="text-muted-foreground italic">Transcription will appear here...</span>
        ) : (
          <p>
            <span className="text-foreground">{finalResult}</span>
            {finalResult && interimResult && <span> </span>}
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground italic"
            >
              {interimResult}
            </motion.span>
          </p>
        )}
      </div>
    </div>
  );
}
