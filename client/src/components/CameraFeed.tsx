import { useEffect, useRef, useCallback } from 'react';
import { Volume2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface CameraFeedProps {
  isDetecting: boolean;
  currentSign: string | null;
  recognizedWords: string[];
  landmarks: any;
  polishedSentence: string;
  isSpeaking: boolean;
  onSpeak: () => void;
  onReset: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

export function CameraFeed({
  isDetecting,
  currentSign,
  recognizedWords,
  landmarks,
  polishedSentence,
  isSpeaking,
  onSpeak,
  onReset,
  videoRef,
}: CameraFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const drawLandmarks = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    if (!landmarks) return;

    const hands = Array.isArray(landmarks) ? landmarks : [landmarks];

    for (const hand of hands) {
      if (!hand || !Array.isArray(hand) || hand.length < 21) continue;

      ctx.strokeStyle = 'cyan';
      ctx.lineWidth = 2;
      for (const [a, b] of HAND_CONNECTIONS) {
        const p1 = hand[a];
        const p2 = hand[b];
        if (!p1 || !p2) continue;
        const x1 = (1 - p1.x) * w;
        const y1 = p1.y * h;
        const x2 = (1 - p2.x) * w;
        const y2 = p2.y * h;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.fillStyle = '#22c55e';
      for (const pt of hand) {
        if (!pt) continue;
        const x = (1 - pt.x) * w;
        const y = pt.y * h;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [landmarks, videoRef]);

  useEffect(() => {
    let active = true;

    const loop = () => {
      if (!active) return;
      drawLandmarks();
      rafRef.current = requestAnimationFrame(loop);
    };

    if (landmarks) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [landmarks, drawLandmarks]);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black/25 backdrop-blur-sm"
      style={{ aspectRatio: '16/10' }}
      data-testid="camera-feed-container"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover block"
        style={{ transform: 'scaleX(-1)' }}
        data-testid="camera-feed-video"
      />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        data-testid="camera-feed-canvas"
      />

      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        {isDetecting ? (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            <span className="text-xs font-semibold text-white/70 tracking-widest uppercase">Detecting</span>
          </>
        ) : (
          <span className="text-xs text-white/25 tracking-wider uppercase">Camera Ready</span>
        )}
      </div>

      <AnimatePresence>
        {currentSign && (
          <motion.div
            key={currentSign}
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            data-testid="current-sign-badge"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
            <span className="text-sm font-semibold text-white">{currentSign}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-3 right-3 mt-10 flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
        {recognizedWords.length > 0 && (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={onSpeak}
              disabled={isSpeaking}
              className="text-white/70 hover-elevate"
              data-testid="button-speak"
            >
              <Volume2 />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onReset}
              className="text-white/70 hover-elevate"
              data-testid="button-clear"
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl pointer-events-none" data-testid="subtitle-area">
        {recognizedWords.length > 0 ? (
          <div className="space-y-2">
            <div
              className="px-5 py-2.5 rounded-lg text-center"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
              data-testid="recognized-words-bar"
            >
              <p className="text-sm md:text-base text-white font-medium leading-relaxed">
                {recognizedWords.join(' ')}
              </p>
            </div>
            {polishedSentence && (
              <div
                className="px-5 py-2 rounded-lg text-center"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
                data-testid="polished-sentence"
              >
                <p className="text-xs md:text-sm text-white/70 italic leading-relaxed">
                  {polishedSentence}
                </p>
              </div>
            )}
          </div>
        ) : isDetecting ? (
          <p className="text-white/20 text-sm text-center">
            Show signs to the camera to begin detection
          </p>
        ) : null}
      </div>
    </div>
  );
}
