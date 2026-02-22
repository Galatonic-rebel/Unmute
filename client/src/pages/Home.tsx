import { useState, useEffect } from 'react';
import { useSpeech } from '@/hooks/use-speech';
import { useCreateTranslation } from '@/hooks/use-translations';
import { SignAvatar } from '@/components/SignAvatar';
import { TranscriptionBox } from '@/components/TranscriptionBox';
import { HistoryPanel } from '@/components/HistoryPanel';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const { 
    isRecording, 
    isConnecting, 
    interimResult, 
    finalResult, 
    currentWord,
    error,
    startRecording, 
    stopRecording,
    reset
  } = useSpeech();
  
  const createTranslation = useCreateTranslation();
  
  // Save translation when stopping if we have content
  const handleToggleRecording = () => {
    if (isRecording || isConnecting) {
      stopRecording();
      if (finalResult.trim()) {
        createTranslation.mutate({ originalText: finalResult.trim() });
      }
    } else {
      reset();
      startRecording();
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col max-w-7xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight">
            Sign<span className="text-gradient">Flow</span>
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Real-time Speech to ASL Translation</p>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Avatar & Transcription */}
        <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
          
          {/* Avatar Area */}
          <SignAvatar 
            currentWord={currentWord} 
            isRecording={isRecording} 
          />

          {/* Controls & Errors */}
          <div className="flex flex-col items-center gap-4">
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-destructive/20 text-destructive-foreground px-6 py-3 rounded-xl border border-destructive/30 flex items-center gap-3"
                >
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleToggleRecording}
              disabled={isConnecting}
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
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Connecting...
                </>
              ) : isRecording ? (
                <>
                  <Square className="w-6 h-6 fill-current" />
                  Stop Translating
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6" />
                  Start Translating
                </>
              )}

              {/* Pulsing ring behind button when recording */}
              {isRecording && (
                <span className="absolute inset-0 rounded-full animate-pulse-glow pointer-events-none -z-10" />
              )}
            </button>
          </div>

          {/* Transcription Area */}
          <TranscriptionBox 
            finalResult={finalResult} 
            interimResult={interimResult} 
          />
        </div>

        {/* Right Column: History */}
        <div className="col-span-1 lg:col-span-4">
          <HistoryPanel />
        </div>

      </main>
    </div>
  );
}
