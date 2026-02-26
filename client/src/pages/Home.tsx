import { useEffect, useRef, useState, useCallback } from 'react';
import { useSpeech } from '@/hooks/use-speech';
import { useSignDetection } from '@/hooks/use-sign-detection';
import { SignAvatar } from '@/components/SignAvatar';
import { CameraFeed } from '@/components/CameraFeed';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Mic, Square, Loader2, AlertCircle, Hand, Camera, ArrowLeftRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import bgImage from '@assets/image_1771963051387.png';

type AppMode = 'speech-to-sign' | 'sign-to-speech';

export default function Home() {
  const [mode, setMode] = useState<AppMode>('speech-to-sign');
  const [polishedSentence, setPolishedSentence] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const {
    isRecording,
    isConnecting,
    interimResult,
    finalResult,
    currentWord,
    newFinalWords,
    error: speechError,
    startRecording,
    stopRecording,
    reset: resetSpeech,
  } = useSpeech();

  const {
    isDetecting,
    recognizedWords,
    currentSign,
    landmarksRef,
    bodyLandmarksRef,
    debugInfo,
    videoRef,
    startDetection,
    stopDetection,
    reset: resetDetection,
  } = useSignDetection();

  const handleToggleMode = useCallback(() => {
    if (isRecording || isConnecting) stopRecording();
    if (isDetecting) stopDetection();
    setPolishedSentence('');
    setSignError(null);
    resetSpeech();
    resetDetection();
    setMode((prev) => (prev === 'speech-to-sign' ? 'sign-to-speech' : 'speech-to-sign'));
  }, [isRecording, isConnecting, isDetecting, stopRecording, stopDetection, resetSpeech, resetDetection]);

  const handleToggleAction = useCallback(async () => {
    if (mode === 'speech-to-sign') {
      if (isRecording || isConnecting) {
        stopRecording();
      } else {
        resetSpeech();
        startRecording();
      }
    } else {
      if (isDetecting) {
        stopDetection();
      } else {
        setSignError(null);
        try {
          await startDetection();
        } catch (err) {
          setSignError(err instanceof Error ? err.message : 'Could not access camera');
        }
      }
    }
  }, [mode, isRecording, isConnecting, isDetecting, stopRecording, resetSpeech, startRecording, stopDetection, startDetection]);

  const handleSpeak = useCallback(async () => {
    if (recognizedWords.length === 0 || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const polishRes = await fetch('/api/polish-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: recognizedWords }),
      });
      if (!polishRes.ok) throw new Error('Failed to polish sentence');
      const { sentence } = await polishRes.json();
      setPolishedSentence(sentence);

      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence, voice: 'nova' }),
      });
      if (!ttsRes.ok) throw new Error('Failed to generate speech');

      const audioBlob = await ttsRes.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      await audio.play();
    } catch (err) {
      console.error('Speak error:', err);
      setIsSpeaking(false);
    }
  }, [recognizedWords, isSpeaking]);

  const handleResetDetection = useCallback(() => {
    resetDetection();
    setPolishedSentence('');
  }, [resetDetection]);

  const error = mode === 'speech-to-sign' ? speechError : signError;
  const isActive = mode === 'speech-to-sign' ? (isRecording || isConnecting) : isDetecting;

  return (
    <div className="fixed inset-0 overflow-auto" role="application" aria-label="SignFlow — ASL and speech translation application">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})` }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-[2px]" aria-hidden="true" />

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
          <button
            onClick={handleToggleMode}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-white/80 hover:bg-white/20 hover:text-white transition-all duration-200 text-xs tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            data-testid="button-toggle-mode"
            aria-label={`Switch mode — currently ${mode === 'speech-to-sign' ? 'Speech to ASL' : 'ASL to Speech'}`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {mode === 'speech-to-sign' ? 'Speech → ASL' : 'ASL → Speech'}
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 pb-6 gap-5" aria-label="Translation workspace">
          <div className="w-full max-w-4xl">
            {mode === 'speech-to-sign' ? (
              <ErrorBoundary
                fallbackTitle="3D Avatar Error"
                fallbackDescription="The 3D avatar renderer encountered an error. Try refreshing."
              >
                <SignAvatar
                  currentWord={currentWord}
                  isRecording={isRecording}
                  signQueue={newFinalWords.length > 0 ? newFinalWords : undefined}
                  finalResult={finalResult}
                  interimResult={interimResult}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary
                fallbackTitle="Camera Feed Error"
                fallbackDescription="The camera feed encountered an error. Check permissions and try again."
              >
                <CameraFeed
                  isDetecting={isDetecting}
                  currentSign={currentSign}
                  recognizedWords={recognizedWords}
                  landmarksRef={landmarksRef}
                  bodyLandmarksRef={bodyLandmarksRef}
                  debugInfo={debugInfo}
                  polishedSentence={polishedSentence}
                  isSpeaking={isSpeaking}
                  onSpeak={handleSpeak}
                  onReset={handleResetDetection}
                  videoRef={videoRef as React.RefObject<HTMLVideoElement>}
                />
              </ErrorBoundary>
            )}
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
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleToggleAction}
              disabled={isConnecting}
              data-testid="toggle-action-button"
              aria-label={
                mode === 'speech-to-sign'
                  ? isConnecting
                    ? 'Connecting to speech service'
                    : isRecording
                      ? 'Stop speech to ASL translation'
                      : 'Start speech to ASL translation'
                  : isDetecting
                    ? 'Stop ASL sign detection'
                    : 'Start ASL sign detection'
              }
              className={`
                group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full font-bold text-lg transition-all duration-300 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
                ${isActive
                  ? 'bg-red-500/20 text-red-200 border-2 border-red-400/50 hover:bg-red-500/30'
                  : 'bg-white/15 text-white border-2 border-white/25 hover:bg-white/25 hover:border-white/40 hover:-translate-y-1 shadow-lg shadow-black/20'
                }
                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
              `}
            >
              {mode === 'speech-to-sign' ? (
                isConnecting ? (
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
                )
              ) : isDetecting ? (
                <>
                  <Square className="w-5 h-5 fill-current" />
                  Stop Detecting
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Start Detecting
                </>
              )}

              {isActive && (
                <span className="absolute inset-0 rounded-full animate-pulse-glow pointer-events-none -z-10" aria-hidden="true" />
              )}
            </button>

            {mode === 'speech-to-sign' && isRecording && (
              <p className="text-xs text-white/40 text-center">
                Speak naturally — the avatar will sign each word in real-time
              </p>
            )}
            {mode === 'sign-to-speech' && isDetecting && (
              <p className="text-xs text-white/40 text-center">
                Show ASL signs to the camera — detected signs will appear as text
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
