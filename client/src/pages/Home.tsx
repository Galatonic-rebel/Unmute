import { useEffect, useRef } from 'react';
import { useSpeech } from '@/hooks/use-speech';
import { SignAvatar } from '@/components/SignAvatar';
import { TranscriptionBox } from '@/components/TranscriptionBox';
import { Mic, Square, Loader2, AlertCircle, Hand } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import bgImage from '@assets/image_1771963051387.png';

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
    <div className="fixed inset-0 overflow-auto">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-[2px]" />

      <div className="min-h-screen flex flex-col">
        <header className="px-6 md:px-10 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center" data-testid="logo-icon">
              <Hand className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">
                Sign<span className="text-gradient">Flow</span>
              </h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-white/40 tracking-wide">
            <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
              Speech → ASL
            </span>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 pb-6 gap-5">
          <div className="w-full max-w-4xl">
            <SignAvatar
              currentWord={currentWord}
              isRecording={isRecording}
              signQueue={newFinalWords.length > 0 ? newFinalWords : undefined}
            />
          </div>

          <div className="flex flex-col items-center gap-3">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-red-500/15 text-red-200 px-5 py-2.5 rounded-xl border border-red-500/25 backdrop-blur-sm flex items-center gap-2.5 text-sm"
                  data-testid="error-message"
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
                group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 backdrop-blur-sm
                ${isRecording
                  ? 'bg-red-500/20 text-red-200 border-2 border-red-400/50 hover:bg-red-500/30'
                  : 'bg-white/15 text-white border-2 border-white/25 hover:bg-white/25 hover:border-white/40 hover:-translate-y-1 shadow-lg shadow-black/20'
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
              <p className="text-xs text-white/40 text-center">
                Speak naturally — the avatar will sign each word in real-time
              </p>
            )}
          </div>

          <div className="w-full max-w-4xl">
            <TranscriptionBox
              finalResult={finalResult}
              interimResult={interimResult}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
