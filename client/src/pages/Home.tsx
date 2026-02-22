import { useEffect, useRef } from 'react';
import { useSpeech } from '@/hooks/use-speech';
import { SignAvatar } from '@/components/SignAvatar';
import { TranscriptionBox } from '@/components/TranscriptionBox';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const {
    isRecording,
    isConnecting,
    interimResult,
    finalResult,
    currentWord,
    newFinalWords,
    error,
    startRecording,
    stopRecording,
    reset,
  } = useSpeech();

  const signQueueRef = useRef<string[]>([]);

  useEffect(() => {
    if (newFinalWords.length > 0) {
      signQueueRef.current = [...newFinalWords];
    }
  }, [newFinalWords]);

  const handleToggleRecording = () => {
    if (isRecording || isConnecting) {
      stopRecording();
    } else {
      reset();
      startRecording();
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col max-w-5xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight">
            Sign<span className="text-gradient">Flow</span>
          </h1>
          <p className="text-muted-foreground mt-1.5 font-medium">Real-time Speech → ASL Translation</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted-foreground/50 tracking-wide">Powered by Deepgram + 3D ASL</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-5">

        {/* 3D Avatar */}
        <SignAvatar
          currentWord={currentWord}
          isRecording={isRecording}
          signQueue={newFinalWords.length > 0 ? newFinalWords : undefined}
        />

        {/* Controls */}
        <div className="flex flex-col items-center gap-3">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-destructive/15 text-destructive-foreground px-5 py-2.5 rounded-xl border border-destructive/25 flex items-center gap-2.5 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleToggleRecording}
            disabled={isConnecting}
            data-testid="toggle-recording-button"
            className={`
              group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300
              ${isRecording
                ? 'bg-destructive/10 text-destructive border-2 border-destructive/50 hover:bg-destructive/20'
                : 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-1'
              }
              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
            `}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Connecting…
              </>
            ) : isRecording ? (
              <>
                <Square className="w-5 h-5 fill-current" />
                Stop Translating
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                Start Translating
              </>
            )}

            {isRecording && (
              <span className="absolute inset-0 rounded-full animate-pulse-glow pointer-events-none -z-10" />
            )}
          </button>

          {isRecording && (
            <p className="text-xs text-muted-foreground/60 text-center">
              Speak naturally — the avatar will sign each word in real-time ASL
            </p>
          )}
        </div>

        {/* Transcription */}
        <TranscriptionBox
          finalResult={finalResult}
          interimResult={interimResult}
        />

      </main>
    </div>
  );
}
