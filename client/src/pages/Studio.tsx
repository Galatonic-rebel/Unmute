// ============================================================
// unmute — two-panel sign communication app (built on the SignFlow engine)
// LEFT:  webcam → MediaPipe → SignMatcher (curated ASL vocabulary) → captions
// RIGHT: typed text → SignAvatar (pose dictionary + FBX + fingerspelling)
//
// Reuses (unchanged): pose-detector.ts, sign-matcher.ts (new optional
// vocabulary restriction), avatar-model.ts, asl-poses.ts, asl-animation.ts,
// SignAvatar.tsx (new optional onWordChange callback).
//
// Intentionally NOT used from the original app: Deepgram STT, DeepSeek LLM
// polishing, OpenAI TTS, PostgreSQL history — all paid/heavyweight, replaced
// by typed text + captions + (optional) free browser SpeechSynthesis.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CameraOff, RotateCcw, Send, Volume2, VolumeX, Hand,
  Loader2, AlertTriangle, Type, CheckCircle2, CircleDashed, Sparkles,
  MessageSquare, Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSignDetection } from '@/hooks/use-sign-detection';
import { SignAvatar } from '@/components/SignAvatar';
import { lookupSign } from '@/lib/asl-poses';

// ────────────────────────────────────────────────────────────
// Curated prototype vocabulary.
// Selection criteria: each sign must be separable from every other
// sign in the pool at the matcher's FIRST-STATIC-FRAME level
// (distinct handshape AND/OR distinct body region), because the
// existing matcher does not compare motion trajectories.
//
// Excluded on purpose:
//   'good'   — identical first frame to 'thank you' (FLAT_B at chin)
//   'my'     — near-identical first frame to 'please' (FLAT_B at chest)
//   A–Z fingerspelling letters — they out-rank real signs for open
//   handshapes (letter candidates score with posDist = 0).
// ============================================================
const SUPPORTED_SIGNS = [
  'hello', 'thank you', 'yes', 'no', 'please', 'sorry',
  'help', 'water', 'eat', 'drink', 'want',
] as const;

const SUPPORTED_SIGNS_HINTS: Record<string, string> = {
  hello: 'open hand at temple, wiggle',
  'thank you': 'flat hand at chin, sweep forward',
  yes: 'fist, nod up and down',
  no: 'two fingers tap thumb',
  please: 'flat hand on chest, rub circles',
  sorry: 'fist on chest, rub circles',
  help: 'fist on open palm, raise together',
  water: 'W-handshape at lips, tap',
  eat: 'O-handshape at mouth, repeat',
  drink: 'C-handshape at mouth, tilt',
  want: 'both open hands, pull toward you',
};

/** Distance bands (matcher's threshold is 0.42). */
const MATCH_THRESHOLD = 0.42;
const UNCERTAIN_BAND = 0.62;

/**
 * Utterance is considered complete after this much silence following the
 * last recognized sign (simple end-of-utterance detection).
 */
const UTTERANCE_PAUSE_MS = 3500;

/**
 * Local rule-based reply engine (no API, no LLM). Maps recognized sign
 * utterances to short replies that the avatar signs back. Replies are kept
 * short so fingerspelling fallback stays brief.
 */
const COMBO_REPLIES: Array<{ all: string[]; reply: string }> = [
  { all: ['want', 'water'], reply: 'sure bringing water now' },
  { all: ['want', 'eat'], reply: 'yes food is coming' },
  { all: ['hello', 'thank you'], reply: 'hello you are welcome' },
];

/** Multiple variants per intent + rotation so replies don't feel canned. */
const SINGLE_REPLIES: Record<string, string[]> = {
  hello: ['hello nice to meet you', 'hi there good to see you'],
  'thank you': ['you are welcome', 'no need to thank me'],
  thanks: ['you are welcome', 'any time'],
  yes: ['great will do that', 'ok good'],
  no: ['okay understood no problem', 'alright noted'],
  please: ['sure happy to help', 'of course'],
  sorry: ['no worries at all', 'its completely fine'],
  help: ['i am here what do you need', 'tell me how to help'],
  water: ['i will get you water', 'one water coming up'],
  eat: ['good i will bring food', 'want me to bring something'],
  drink: ['here is a drink for you', 'i will bring one'],
  want: ['tell me what you want', 'happy to get it for you'],
};

/** Maps a recognized sign utterance to a reply string (empty → fallback). */
const replyVariantRef = { i: 0 };

function generateReply(utteranceWords: string[]): string {
  const set = new Set(utteranceWords);
  for (const combo of COMBO_REPLIES) {
    if (combo.all.every((w) => set.has(w))) return combo.reply;
  }
  for (const word of utteranceWords) {
    const variants = SINGLE_REPLIES[word];
    if (variants?.length) {
      const reply = variants[replyVariantRef.i % variants.length];
      replyVariantRef.i++;
      return reply;
    }
  }
  return `i understood ${utteranceWords.join(' ')}`;
}

type CameraStatus = 'off' | 'starting' | 'on' | 'denied' | 'no-camera' | 'error';

interface TranscriptEntry {
  id: number;
  word: string;
  confidence: number;
  at: string;
}

/** One side of the conversation shown in the right panel. */
interface ChatTurn {
  id: number;
  role: 'signed' | 'typed' | 'reply';
  text: string;
  at: string;
}

/** Signing mode descriptions surfaced by SignAvatar.onWordChange. */
const MODE_TAG: Record<string, { label: string; className: string }> = {
  fbx: { label: 'mocap animation', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  pose: { label: 'procedural sign', className: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  fingerspell: { label: 'fingerspelled (no sign)', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
};

export default function Studio() {
  // ── LEFT: sign → text ──────────────────────────────────────
  const {
    isDetecting,
    recognizedWords,
    currentSign,
    lastConfidence,
    landmarksRef,
    bodyLandmarksRef,
    debugInfo,
    videoRef,
    startDetection,
    stopDetection,
    reset: resetDetection,
  } = useSignDetection({ vocabulary: [...SUPPORTED_SIGNS], includeLetters: false });

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('off');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptIdRef = useRef(0);

  // ── Conversation state ─────────────────────────────────────
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [utteranceBuffer, setUtteranceBuffer] = useState<string[]>([]);
  const [autoReply, setAutoReply] = useState(true);
  const bufferRef = useRef<string[]>([]);
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatIdRef = useRef(0);
  const autoReplyRef = useRef(autoReply);
  autoReplyRef.current = autoReply;
  /** Assigned below; the recognition effect schedules it after every sign. */
  const flushRef = useRef<() => void>(() => {});

  // Persist recognition events from the hook into a readable transcript,
  // and buffer them into utterances (flushed after a short pause → reply).
  useEffect(() => {
    if (currentSign && lastConfidence !== null) {
      const word = currentSign;
      const confidence = lastConfidence;
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.word === word && Date.now() - Date.parse(last.at) < 4000) return prev;
        return [...prev, {
          id: ++transcriptIdRef.current,
          word,
          confidence,
          at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        }];
      });

      // Utterance buffering: identical consecutive word is a repetition (yes/yes) — keep it.
      bufferRef.current = [...bufferRef.current, word];
      setUtteranceBuffer(bufferRef.current);
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = setTimeout(() => flushRef.current(), UTTERANCE_PAUSE_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSign]);

  const handleStartCamera = useCallback(async () => {
    setCameraError(null);
    setCameraStatus('starting');
    try {
      await startDetection();
      setCameraStatus('on');
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const message = err instanceof Error ? err.message : String(err);
      if (name === 'NotAllowedError' || /denied|permission/i.test(message)) {
        setCameraStatus('denied');
        setCameraError('Camera permission was denied. Allow camera access in your browser settings, then try again.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setCameraStatus('no-camera');
        setCameraError('No camera was found. Connect a webcam and try again.');
      } else {
        setCameraStatus('error');
        setCameraError(`Could not start the camera: ${message}`);
      }
    }
  }, [startDetection]);

  const handleStopCamera = useCallback(() => {
    stopDetection();
    setCameraStatus('off');
  }, [stopDetection]);

  const handleResetAll = useCallback(() => {
    setTranscript([]);
    setChat([]);
    setUtteranceBuffer([]);
    setSentMessage('');
    setNowSigning(null);
    setSignQueue([]);
    bufferRef.current = [];
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
    resetDetection();
  }, [resetDetection]);

  // Uncertainty feedback — derived from the matcher's live top candidate.
  const recognitionStatus = useMemo(() => {
    const top = debugInfo?.candidates[0];
    if (!isDetecting) return { kind: 'off' as const, text: 'Camera off' };
    if (!top) return { kind: 'idle' as const, text: 'No hands in view' };
    if (top.distance < MATCH_THRESHOLD) {
      return { kind: 'locking' as const, text: `Detecting "${top.word}" — hold still` };
    }
    if (top.distance < UNCERTAIN_BAND) {
      return {
        kind: 'uncertain' as const,
        text: `Gesture visible — uncertain (closest: "${top.word}")`,
        word: top.word,
      };
    }
    return { kind: 'idle' as const, text: 'No supported sign detected' };
  }, [debugInfo, isDetecting]);

  // ── RIGHT: text → sign ─────────────────────────────────────
  const [message, setMessage] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const [signQueue, setSignQueue] = useState<string[]>([]);
  const [nowSigning, setNowSigning] = useState<{ word: string; mode: string } | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  /** Avatar playback pace: >1 slower (more readable), <1 faster. */
  const [pace, setPace] = useState(1.3);

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  /** Adds a turn to the conversation shown in the right panel. */
  const addTurn = useCallback((role: ChatTurn['role'], text: string) => {
    setChat((prev) => [...prev, {
      id: ++chatIdRef.current,
      role,
      text,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }]);
  }, []);

  /** Displays text as a caption and queues it for the avatar (+ optional voice). */
  const signText = useCallback((text: string) => {
    const words = text.toLowerCase().replace(/[^a-z'\s-]/gi, ' ').split(/\s+/).filter(Boolean);
    setSentMessage(text);
    setNowSigning(null);
    setSignQueue(words);   // fresh array reference every call → re-plays even identical text
    if (ttsEnabled && ttsSupported) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1;
        window.speechSynthesis.speak(u);
      } catch {
        /* non-fatal */
      }
    }
  }, [ttsEnabled, ttsSupported]);

  /**
   * End of utterance (pause after last recognized sign): record what was
   * signed and — if auto-reply is on — generate a local rule-based reply,
   * show it as a caption, and have the avatar sign it back.
   */
  const flushUtterance = useCallback(() => {
    const words = bufferRef.current;
    bufferRef.current = [];
    setUtteranceBuffer([]);
    if (!words.length) return;
    addTurn('signed', words.join(' '));
    if (autoReplyRef.current) {
      const reply = generateReply(words);
      addTurn('reply', reply);
      signText(reply);
    }
  }, [addTurn, signText]);
  flushRef.current = flushUtterance;

  const handleSend = useCallback((raw?: string) => {
    const text = (raw ?? message).trim();
    if (!text) return;
    addTurn('typed', text);
    signText(text);
  }, [message, addTurn, signText]);

  const tokens = useMemo(
    () => message.toLowerCase().replace(/[^a-z'\s-]/gi, ' ').split(/\s+/).filter(Boolean),
    [message],
  );

  const tokenReport = useMemo(
    () => tokens.map((word) => ({ word, hasSign: lookupSign(word) !== null })),
    [tokens],
  );

  const handleAvatarWord = useCallback((word: string, mode: string | null) => {
    setNowSigning({ word, mode: mode ?? 'unknown' });
  }, []);

  const handleAvatarIdle = useCallback(() => {
    setNowSigning(null);
  }, []);

  const quickReplies = [
    'hello nice to meet you',
    'thank you so much',
    'yes I understand',
    'sorry please help me',
  ];

  // ── landmark overlay (adapted from CameraFeed.tsx, mirrored) ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
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

    const HAND_CONNECTIONS: Array<[number, number]> = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ];
    const BODY_CONNECTIONS: Array<[number, number]> = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
    ];

    const draw = () => {
      if (!active) return;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          ctx.clearRect(0, 0, w, h);

          const body = bodyLandmarksRef.current;
          if (body && body.length >= 25) {
            ctx.strokeStyle = 'rgba(255, 200, 50, 0.6)';
            ctx.lineWidth = 2;
            for (const [a, b] of BODY_CONNECTIONS) {
              const p1 = body[a], p2 = body[b];
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
          }

          const hands = landmarksRef.current;
          if (hands) {
            const handList = Array.isArray(hands) ? hands : [hands];
            for (const hand of handList) {
              if (!hand || !Array.isArray(hand) || hand.length < 21) continue;
              ctx.strokeStyle = 'cyan';
              ctx.lineWidth = 2;
              for (const [a, b] of HAND_CONNECTIONS) {
                const p1 = hand[a], p2 = hand[b];
                if (!p1 || !p2) continue;
                ctx.beginPath();
                ctx.moveTo((1 - p1.x) * w, p1.y * h);
                ctx.lineTo((1 - p2.x) * w, p2.y * h);
                ctx.stroke();
              }
              ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
              for (const pt of hand) {
                ctx.beginPath();
                ctx.arc((1 - pt.x) * w, pt.y * h, 2.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { active = false; cancelAnimationFrame(rafRef.current); };
  }, [isDetecting, videoRef, landmarksRef, bodyLandmarksRef]);

  // ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      {/* Ambient background (matches the original app's atmosphere) */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-48 w-[560px] h-[560px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[420px] h-[420px] rounded-full bg-sky-500/5 blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 grid place-items-center shrink-0 shadow-lg shadow-emerald-500/10">
              <Hand className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight truncate">
                un<span className="text-gradient">mute</span>
              </h1>
              <p className="text-[11px] text-slate-400 leading-tight">sign without words</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-white/15 bg-white/5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ASL · {SUPPORTED_SIGNS.length} signs
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ══════════ LEFT PANEL — Sign → Text ══════════ */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden flex flex-col shadow-xl shadow-black/30 transition-colors hover:border-white/20">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-400/20 grid place-items-center">
                    <Camera className="w-3.5 h-3.5 text-emerald-300" />
                  </span>
                  Sign&thinsp;→&thinsp;Text
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Sign one of the supported signs to the camera</p>
              </div>
              <span
                className={`text-[11px] px-2.5 py-1 rounded-full border shrink-0 ${
                  cameraStatus === 'on' && isDetecting
                    ? 'border-red-500/40 bg-red-500/10 text-red-300'
                    : cameraStatus === 'starting'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border-white/10 bg-white/5 text-slate-400'
                }`}
              >
                {cameraStatus === 'starting' ? 'Starting…' :
                  cameraStatus === 'on' && isDetecting ? 'Live · 15 fps' :
                  cameraStatus === 'denied' ? 'Permission denied' :
                  cameraStatus === 'no-camera' ? 'No camera' :
                  cameraStatus === 'error' ? 'Error' : 'Camera off'}
              </span>
            </div>

            {/* Video area */}
            <div className="relative aspect-video bg-black mx-4 mt-4 rounded-xl overflow-hidden ring-1 ring-white/10">
              <video
                ref={videoRef as unknown as React.RefObject<HTMLVideoElement>}
                className="absolute inset-0 w-full h-full object-cover -scale-x-100"
                playsInline
                muted
                autoPlay
              />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

              {/* Empty state */}
              {!isDetecting && cameraStatus !== 'starting' && (
                <div className="absolute inset-0 grid place-items-center bg-slate-950/80 text-center px-6">
                  <div>
                    <CameraOff className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-300 font-medium">Camera is off</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Start the camera, then hold one supported sign still for about a second.
                    </p>
                  </div>
                </div>
              )}

              {cameraStatus === 'starting' && (
                <div className="absolute inset-0 grid place-items-center bg-slate-950/80">
                  <div className="text-center">
                    <Loader2 className="w-7 h-7 text-emerald-400 animate-spin mx-auto mb-3" />
                    <p className="text-xs text-slate-400">Requesting camera access…</p>
                  </div>
                </div>
              )}

              {/* Detection status chip */}
              {isDetecting && (
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-white/80 tracking-widest uppercase">
                    Detecting
                  </span>
                </div>
              )}
            </div>

            {/* Error banner */}
            {cameraError && (
              <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-200">{cameraError}</p>
              </div>
            )}

            {/* Controls */}
            <div className="px-4 py-3 flex items-center gap-2">
              {isDetecting ? (
                <Button size="sm" variant="destructive" onClick={handleStopCamera} className="gap-2 rounded-full">
                  <CameraOff className="w-3.5 h-3.5" /> Stop camera
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStartCamera}
                  disabled={cameraStatus === 'starting'}
                  className="gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 text-white font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:brightness-110 border-0"
                >
                  <Camera className="w-3.5 h-3.5" /> Start camera
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleResetAll} className="gap-2 rounded-full border-white/15 text-slate-300 hover:bg-white/10">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </Button>
              <span className="ml-auto text-[11px] text-slate-500 hidden sm:block">
                MediaPipe · runs locally, no data leaves this page
              </span>
            </div>

            {/* Live recognition status */}
            <div className="mx-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center justify-between gap-3 min-h-10">
                <div className="min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentSign ?? recognitionStatus.text}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`text-lg font-semibold truncate ${
                        currentSign ? 'text-emerald-300' : 'text-slate-400'
                      }`}
                    >
                      {currentSign ?? recognitionStatus.text}
                    </motion.p>
                  </AnimatePresence>
                </div>
                {currentSign && lastConfidence !== null && (
                  <div className="shrink-0 w-24">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                      <span>confidence</span>
                      <span>{Math.round(lastConfidence * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-300 shadow-sm shadow-emerald-500/30"
                        style={{ width: `${Math.max(4, Math.round(lastConfidence * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                {recognitionStatus.kind === 'uncertain' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">
                    <AlertTriangle className="w-3 h-3" /> {recognitionStatus.text}
                  </span>
                ) : recognitionStatus.kind === 'locking' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                    <CircleDashed className="w-3 h-3 animate-spin" /> {recognitionStatus.text}
                  </span>
                ) : recognitionStatus.kind === 'off' ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800/60 text-slate-400">
                    <CameraOff className="w-3 h-3" /> {recognitionStatus.text}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800/60 text-slate-400">
                    <CircleDashed className="w-3 h-3" /> {recognitionStatus.text}
                  </span>
                )}
              </div>
            </div>

            {/* Transcript */}
            <div className="mx-4 mb-4 mt-3 flex-1 rounded-xl border border-white/10 bg-white/5 flex flex-col min-h-[120px] max-h-64">
              <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Transcript</span>
                {transcript.length > 0 && (
                  <span className="text-[10px] text-slate-500">{transcript.length} signs</span>
                )}
              </div>
              <div className="overflow-y-auto px-3 py-2 space-y-1">
                {transcript.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    Recognized signs appear here as a readable transcript.
                  </p>
                ) : (
                  transcript.map((entry) => (
                    <div key={entry.id} className="flex items-baseline gap-2 text-sm">
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">{entry.at}</span>
                      <span className="font-medium text-slate-100">{entry.word}</span>
                      <span className="text-[10px] text-slate-500 ml-auto shrink-0">
                        {Math.round(entry.confidence * 100)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Supported vocabulary */}
            <div className="px-4 pb-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Supported signs — nothing else produces captions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_SIGNS.map((sign) => {
                  const active = currentSign === sign;
                  return (
                    <span
                      key={sign}
                      title={SUPPORTED_SIGNS_HINTS[sign]}
                      className={`text-[11px] px-2.5 py-1 rounded-full border cursor-default transition-all ${
                        active
                          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-md shadow-emerald-500/15 scale-105'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {sign}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ══════════ RIGHT PANEL — Text → Sign ══════════ */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden flex flex-col shadow-xl shadow-black/30 transition-colors hover:border-white/20">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-400/20 grid place-items-center">
                    <Type className="w-3.5 h-3.5 text-indigo-300" />
                  </span>
                  Text&thinsp;→&thinsp;Sign
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Type a message — the avatar signs it back</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAutoReply((v) => !v)}
                  className={`gap-1.5 text-xs ${autoReply ? 'text-emerald-300' : 'text-slate-500'}`}
                  title="When on, recognized signs get an automatic local rule-based reply that the avatar signs back"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-reply
                </Button>
                {ttsSupported ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTtsEnabled((v) => !v)}
                    className={`gap-1.5 text-xs ${ttsEnabled ? 'text-indigo-300' : 'text-slate-500'}`}
                    title="Speak the message aloud (free browser speech synthesis)"
                  >
                    {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    Voice
                  </Button>
                ) : null}
                <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5">
                  {[
                    { label: 'S', value: 1.6, title: 'Slow — each sign is held longer' },
                    { label: 'N', value: 1.3, title: 'Normal pace' },
                    { label: 'F', value: 0.8, title: 'Fast' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setPace(opt.value)}
                      title={opt.title}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        pace === opt.value
                          ? 'bg-slate-700 text-slate-100'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Avatar area */}
            <div className="relative aspect-[4/3] bg-gradient-to-b from-slate-800/80 to-slate-950 mx-4 mt-4 rounded-xl overflow-hidden ring-1 ring-white/10">
              <SignAvatar
                currentWord=""
                isRecording={false}
                signQueue={signQueue}
                onWordChange={handleAvatarWord}
                onIdle={handleAvatarIdle}
                hideSpeechLabels
                pace={pace}
              />
              {/* Playing indicator */}
              {nowSigning && (
                <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-[11px] font-semibold text-white/80 tracking-widest uppercase">Signing</span>
                </div>
              )}
              {/* Empty state */}
              {signQueue.length === 0 && !nowSigning && (
                <div className="absolute inset-0 grid place-items-center text-center px-6 pointer-events-none">
                  <div>
                    <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-300 font-medium">Avatar is idle</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      Send a message below and the 3D avatar will sign it — word signs where available,
                      fingerspelling as fallback.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Conversation */}
            <div className="mx-4 mt-3 rounded-xl border border-white/10 bg-white/5 flex flex-col min-h-[110px] max-h-52">
              <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Conversation
                </span>
                {utteranceBuffer.length > 0 && (
                  <span className="text-[10px] text-indigo-300/90 flex items-center gap-1.5">
                    <CircleDashed className="w-3 h-3 animate-spin" />
                    collecting: {utteranceBuffer.join(' ')}
                  </span>
                )}
              </div>
              <div className="overflow-y-auto px-3 py-2 space-y-1.5 flex-1">
                {chat.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Sign to the camera or type a message — recognized utterances and
                    replies appear here in order.
                  </p>
                ) : (
                  chat.map((turn) => {
                    const isReply = turn.role === 'reply';
                    return (
                      <div key={turn.id} className={`flex items-start gap-2 ${isReply ? 'flex-row-reverse' : ''}`}>
                        <span className={`mt-0.5 shrink-0 ${isReply ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {isReply ? <Bot className="w-3.5 h-3.5" /> : <Hand className="w-3.5 h-3.5" />}
                        </span>
                        <div
                          className={`max-w-[85%] rounded-xl px-3 py-2 border backdrop-blur-sm ${
                            isReply
                              ? 'border-emerald-500/30 bg-emerald-500/10 shadow-md shadow-emerald-500/10'
                              : 'border-white/10 bg-white/5'
                          }`}
                        >
                          <div className="flex items-baseline gap-2">
                            <span className={`text-[10px] uppercase tracking-wider ${isReply ? 'text-emerald-400/80' : 'text-slate-500'}`}>
                              {isReply ? 'Reply' : turn.role === 'signed' ? 'You signed' : 'You typed'}
                            </span>
                            <span className="text-[10px] text-slate-600 font-mono">{turn.at}</span>
                          </div>
                          <p className="text-sm text-slate-100 mt-0.5">{turn.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Caption under avatar */}
            <div className="mx-4 mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-h-[76px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {sentMessage ? 'Message being signed' : 'No message yet'}
                  </p>
                  <p className={`text-sm truncate ${sentMessage ? 'text-slate-100' : 'text-slate-500'}`}>
                    {sentMessage || 'Type a message and press Send…'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {nowSigning ? (
                    <>
                      <p className="text-xs font-semibold text-indigo-300">“{nowSigning.word}”</p>
                      {MODE_TAG[nowSigning.mode] && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${MODE_TAG[nowSigning.mode].className}`}>
                          {MODE_TAG[nowSigning.mode].label}
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Type your message…"
                  className="flex-1 h-10 rounded-full border border-white/15 bg-white/5 px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 backdrop-blur-sm"
                  aria-label="Message to sign"
                />
                <Button
                  size="sm"
                  onClick={() => handleSend()}
                  disabled={!message.trim()}
                  className="gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 hover:brightness-110 border-0"
                >
                  <Send className="w-3.5 h-3.5" /> Send
                </Button>
              </div>

              {/* Quick replies */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">Quick replies</span>
                {quickReplies.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => { setMessage(reply); handleSend(reply); }}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white hover:border-white/25 transition-colors"
                  >
                    “{reply}”
                  </button>
                ))}
              </div>

              {/* Vocabulary availability report */}
              {message.trim() && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2.5">
                  {tokenReport.slice(0, 12).map(({ word, hasSign }, i) => (
                    <span
                      key={word + i}
                      title={hasSign ? 'Has a sign' : 'No sign — will be fingerspelled'}
                      className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                        hasSign
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {hasSign ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                      {word}
                    </span>
                  ))}
                  {(tokenReport.some((t) => !t.hasSign)) && (
                    <span className="text-[10px] text-amber-300/80">
                      words without signs are fingerspelled letter-by-letter
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer disclosure */}
        <p className="text-[11px] text-slate-600 text-center mt-6 max-w-2xl mx-auto leading-relaxed">
          Prototype — American Sign Language (ASL) only, limited vocabulary, static-pose matching.
          Not affiliated with full ASL interpretation. Recognition runs locally in the browser via MediaPipe;
          no video or audio is uploaded. The avatar uses the SignFlow pose dictionary ({'~'}610 word signs)
          with FBX mocap and fingerspelling fallbacks.
        </p>
      </main>
    </div>
  );
}
