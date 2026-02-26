import { useEffect, useRef, useState } from 'react';
import { Volume2, Trash2, Bug } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { DebugInfo } from '@/hooks/use-sign-detection';

interface CameraFeedProps {
  isDetecting: boolean;
  currentSign: string | null;
  recognizedWords: string[];
  landmarksRef: React.RefObject<NormalizedLandmark[][] | null>;
  bodyLandmarksRef: React.RefObject<NormalizedLandmark[] | null>;
  debugInfo: DebugInfo | null;
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

const BODY_CONNECTIONS = [
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 23], [12, 24],
  [23, 24],
];

export function CameraFeed({
  isDetecting,
  currentSign,
  recognizedWords,
  landmarksRef,
  bodyLandmarksRef,
  debugInfo,
  polishedSentence,
  isSpeaking,
  onSpeak,
  onReset,
  videoRef,
}: CameraFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (!isDetecting) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let active = true;

    const draw = () => {
      if (!active) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }

          ctx.clearRect(0, 0, w, h);

          const body = bodyLandmarksRef.current;
          if (body && body.length >= 25) {
            ctx.strokeStyle = 'rgba(255, 200, 50, 0.6)';
            ctx.lineWidth = 2;
            for (const [a, b] of BODY_CONNECTIONS) {
              const p1 = body[a];
              const p2 = body[b];
              if (!p1 || !p2) continue;
              ctx.beginPath();
              ctx.moveTo((1 - p1.x) * w, p1.y * h);
              ctx.lineTo((1 - p2.x) * w, p2.y * h);
              ctx.stroke();
            }

            ctx.fillStyle = 'rgba(255, 200, 50, 0.5)';
            for (const idx of [11, 12, 13, 14, 15, 16, 23, 24]) {
              const pt = body[idx];
              if (!pt) continue;
              ctx.beginPath();
              ctx.arc((1 - pt.x) * w, pt.y * h, 3, 0, Math.PI * 2);
              ctx.fill();
            }

            const nose = body[0];
            if (nose) {
              ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.arc((1 - nose.x) * w, nose.y * h, 30, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }

          const hands = landmarksRef.current;
          if (hands) {
            const handList = Array.isArray(hands) ? hands : [hands];
            for (const hand of handList) {
              if (!hand || !Array.isArray(hand) || hand.length < 21) continue;

              ctx.strokeStyle = 'cyan';
              ctx.lineWidth = 2;
              for (const [a, b] of HAND_CONNECTIONS) {
                const p1 = hand[a];
                const p2 = hand[b];
                if (!p1 || !p2) continue;
                ctx.beginPath();
                ctx.moveTo((1 - p1.x) * w, p1.y * h);
                ctx.lineTo((1 - p2.x) * w, p2.y * h);
                ctx.stroke();
              }

              ctx.fillStyle = '#22c55e';
              for (const pt of hand) {
                if (!pt) continue;
                ctx.beginPath();
                ctx.arc((1 - pt.x) * w, pt.y * h, 4, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isDetecting, videoRef, landmarksRef, bodyLandmarksRef]);

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

      <div className="absolute top-3 left-3 flex items-center gap-2">
        {isDetecting ? (
          <div className="flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            <span className="text-xs font-semibold text-white/70 tracking-widest uppercase">Detecting</span>
          </div>
        ) : (
          <span className="text-xs text-white/25 tracking-wider uppercase pointer-events-none">Camera Ready</span>
        )}
        {isDetecting && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowDebug((v) => !v)}
            className={`w-6 h-6 ${showDebug ? 'text-yellow-400' : 'text-white/30'}`}
            data-testid="button-debug-toggle"
          >
            <Bug className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {showDebug && debugInfo && isDetecting && (
        <div
          className="absolute top-10 left-3 text-[10px] font-mono leading-tight max-w-[200px] p-2 rounded-lg pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          data-testid="debug-panel"
        >
          <div className="text-yellow-300 font-bold mb-1">
            {debugInfo.region} (posY: {debugInfo.posY.toFixed(2)})
          </div>
          {debugInfo.candidates.length > 0 && (
            <div className="space-y-0.5">
              {debugInfo.candidates.map((c, i) => (
                <div key={i} className={i === 0 ? 'text-green-300' : 'text-white/50'}>
                  {c.word}: {c.distance.toFixed(3)}
                  <span className="text-white/30"> s:{c.shapeDist.toFixed(2)} p:{c.posDist.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
              className="text-white/70"
              data-testid="button-speak"
            >
              <Volume2 />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onReset}
              className="text-white/70"
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
            Show ASL signs to the camera — hands, arms, and face are all tracked
          </p>
        ) : null}
      </div>
    </div>
  );
}
