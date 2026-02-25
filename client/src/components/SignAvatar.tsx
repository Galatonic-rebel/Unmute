import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AvatarController } from '@/lib/avatar-model';
import { wordToSignQueue, NEUTRAL_FACE, type FaceExpression, type HandPose } from '@/lib/asl-poses';
import { getWordAnimationUrl, getLetterAnimationUrl, hasWordAnimation } from '@/lib/asl-animation';

interface SignAvatarProps {
  currentWord: string;
  isRecording: boolean;
  signQueue?: string[];
  finalResult?: string;
  interimResult?: string;
}

interface QueueItem {
  right: HandPose;
  left:  HandPose;
  face?: FaceExpression;
  holdMs: number;
}

const IDLE_RIGHT: HandPose = {
  thumb:  { flex: 0.15, abd: 0.25 },
  index:  { curl: 0.15, spread: -0.05 },
  middle: { curl: 0.15, spread: 0 },
  ring:   { curl: 0.18, spread: 0.05 },
  pinky:  { curl: 0.22, spread: 0.08 },
  wristY: -0.12,
};
const IDLE_LEFT: HandPose = { ...IDLE_RIGHT, wristY: 0.12 };

export function SignAvatar({ currentWord, isRecording, signQueue, finalResult, interimResult }: SignAvatarProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const avatarRef   = useRef<AvatarController | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef      = useRef<number>(0);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const poseQueueRef        = useRef<QueueItem[]>([]);
  const currentItemRef      = useRef<QueueItem | null>(null);
  const itemStartRef        = useRef<number>(0);
  const blinkTimerRef       = useRef<number>(0);
  const nextBlinkRef        = useRef<number>(1800 + Math.random() * 3000);
  const blinkPhaseRef       = useRef<number>(999);
  const prevSignQueueRef    = useRef<string[] | undefined>(undefined);
  const abortRef            = useRef<AbortController | null>(null);
  const signingRef          = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    let avatar: AvatarController;
    let ro: ResizeObserver;
    let cancelled = false;

    async function init() {
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          powerPreference: 'high-performance',
          alpha: true,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
        renderer.shadowMap.enabled   = true;
        renderer.shadowMap.type      = THREE.PCFShadowMap;
        renderer.outputColorSpace    = THREE.SRGBColorSpace;
        renderer.toneMapping         = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        rendererRef.current = renderer;

        const w = Math.max(canvas.clientWidth, 320);
        const h = Math.max(canvas.clientHeight, 200);
        renderer.setSize(w, h, false);

        const scene = new THREE.Scene();
        renderer.setClearColor(0x000000, 0);

        const camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 20);
        camera.position.set(0, 0.32, 1.10);
        camera.lookAt(0, 0.28, 0);

        const pmremGen = new THREE.PMREMGenerator(renderer);
        const envRT = pmremGen.fromScene(new THREE.Scene(), 0.04);
        scene.environment = envRT.texture;
        pmremGen.dispose();

        scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4a5e, 1.4));

        const key = new THREE.DirectionalLight(0xffecd0, 3.5);
        key.position.set(-0.6, 2.0, 1.8);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.near = 0.1;
        key.shadow.camera.far  = 10;
        key.shadow.camera.left = key.shadow.camera.bottom = -1.5;
        key.shadow.camera.right = key.shadow.camera.top = 1.5;
        key.shadow.radius = 4;
        key.shadow.bias   = -0.0003;
        scene.add(key);

        const fill = new THREE.DirectionalLight(0xd0e8ff, 1.6);
        fill.position.set(1.5, 0.6, 1.0);
        scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffd080, 0.8);
        rim.position.set(0, 0.8, -2.5);
        scene.add(rim);

        const bounce = new THREE.DirectionalLight(0xb0b0ff, 0.5);
        bounce.position.set(0, -1.5, 0.8);
        scene.add(bounce);

        const face = new THREE.PointLight(0xffe8d8, 1.0, 3);
        face.position.set(0, 0.45, 0.9);
        scene.add(face);

        avatar = new AvatarController();
        await avatar.load('/avatar.glb');

        if (cancelled) {
          avatar.dispose();
          renderer.dispose();
          return;
        }

        avatar.root.scale.setScalar(0.69);
        avatar.root.position.y = -0.70;
        avatar.root.position.z = 0.02;
        scene.add(avatar.root);
        avatarRef.current = avatar;

        avatar.applyHandPose('right', IDLE_RIGHT, 1);
        avatar.applyHandPose('left', IDLE_LEFT, 1);
        avatar.applyExpression(NEUTRAL_FACE, 1);

        setLoading(false);

        ro = new ResizeObserver(() => {
          const cw = canvas.clientWidth;
          const ch = canvas.clientHeight;
          if (!cw || !ch) return;
          renderer.setSize(cw, ch, false);
          camera.aspect = cw / ch;
          camera.updateProjectionMatrix();
        });
        ro.observe(canvas);

        let prev = performance.now();
        const animate = (now: number) => {
          rafRef.current = requestAnimationFrame(animate);
          const dt = Math.min(now - prev, 50);
          prev = now;

          const av = avatarRef.current;
          if (!av || !av.isLoaded) return;

          av.updateMixer(dt / 1000);
          av.updateRestore(dt);

          const animPlaying = av.isAnimationPlaying();

          if (!animPlaying) {
            if (!currentItemRef.current && poseQueueRef.current.length > 0) {
              currentItemRef.current = poseQueueRef.current.shift()!;
              itemStartRef.current   = now;
            }

            const cur = currentItemRef.current;
            if (cur) {
              av.applySway(now);
              const elapsed = now - itemStartRef.current;
              const frameDur = cur.holdMs * 0.55;
              const blendIn = Math.min(elapsed / 80, 1);
              const eased = blendIn * blendIn * (3 - 2 * blendIn);
              const baseLerp = Math.min(dt / 35, 1);
              const lerpT = baseLerp * (0.4 + 0.6 * eased);
              av.applyHandPose('right', cur.right, lerpT);
              av.applyHandPose('left', cur.left, lerpT);
              av.applyExpression(cur.face ?? NEUTRAL_FACE, lerpT);

              const posT = Math.min(dt / 40, 1) * (0.4 + 0.6 * eased);
              av.setHandTarget('right',
                cur.right.posX ?? 0,
                cur.right.posY ?? 0,
                cur.right.posZ ?? 0,
                posT
              );
              av.setHandTarget('left',
                cur.left.posX ?? 0,
                cur.left.posY ?? 0,
                cur.left.posZ ?? 0,
                posT
              );

              if (elapsed >= frameDur) {
                currentItemRef.current = null;
              }
            } else if (signingRef.current) {
              av.applySway(now);
            } else {
              const idleT = Math.min(dt / 180, 1);
              av.applySway(now);
              av.applyHandPose('right', IDLE_RIGHT, idleT);
              av.applyHandPose('left', IDLE_LEFT, idleT);
              av.applyExpression(NEUTRAL_FACE, idleT);
              av.resetArms(idleT);
            }
          } else {
            av.applySway(now);
          }

          blinkTimerRef.current += dt;
          if (blinkTimerRef.current >= nextBlinkRef.current) {
            blinkTimerRef.current = 0;
            nextBlinkRef.current = 1800 + Math.random() * 3000;
            blinkPhaseRef.current = 0;
          }
          if (blinkPhaseRef.current < 150) {
            blinkPhaseRef.current += dt;
            const bp = blinkPhaseRef.current;
            const blinkVal = bp < 60 ? bp / 60 : bp < 90 ? 1 : 1 - (bp - 90) / 60;
            av.applyExpression({ ...NEUTRAL_FACE, eyeSquint: Math.max(0, blinkVal) }, 0.85);
          }

          renderer.render(scene, camera);
        };
        rafRef.current = requestAnimationFrame(animate);

      } catch (err) {
        console.error('SignAvatar 3D init failed:', err);
        setWebglError(err instanceof Error ? err.message : 'WebGL initialization failed');
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (abortRef.current) abortRef.current.abort();
      if (ro) ro.disconnect();
      if (avatarRef.current) { avatarRef.current.dispose(); avatarRef.current = null; }
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!signQueue?.length || signQueue === prevSignQueueRef.current) return;
    prevSignQueueRef.current = signQueue;

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const av = avatarRef.current;
    if (!av) return;

    poseQueueRef.current   = [];
    currentItemRef.current = null;
    signingRef.current     = true;

    (async () => {
      for (const word of signQueue) {
        if (ac.signal.aborted) break;

        const lower = word.toLowerCase().trim();
        if (!lower) continue;

        if (hasWordAnimation(lower)) {
          try {
            await av.loadAndPlayAnimation(getWordAnimationUrl(lower)!);
          } catch (err) {
            console.warn('FBX animation failed for word:', lower, err);
            const fallback = wordToSignQueue(lower);
            poseQueueRef.current.push(...fallback);
            const totalMs = fallback.reduce((sum, f) => sum + f.holdMs, 0);
            await waitMs(totalMs + 200, ac.signal);
          }
        } else {
          const poseFrames = wordToSignQueue(lower);
          if (poseFrames.length > 0) {
            poseQueueRef.current.push(...poseFrames);
            const totalMs = poseFrames.reduce((sum, f) => sum + f.holdMs, 0);
            await waitMs(totalMs + 200, ac.signal);
          } else {
            for (const letter of lower) {
              if (ac.signal.aborted) break;
              if (/[a-z]/.test(letter)) {
                try {
                  await av.loadAndPlayAnimation(getLetterAnimationUrl(letter));
                } catch (err) {
                  console.warn('FBX letter animation failed:', letter, err);
                }
              }
            }
          }
        }

        if (ac.signal.aborted) break;
      }

      signingRef.current = false;
      if (!ac.signal.aborted) {
        av.restoreToIdle();
      }
    })();
  }, [signQueue]);

  useEffect(() => {
    if (!isRecording) {
      if (abortRef.current) abortRef.current.abort();
      signingRef.current = false;
      const av = avatarRef.current;
      if (av) {
        av.stopAnimation();
        av.restoreToIdle();
      }
      poseQueueRef.current   = [];
      currentItemRef.current = null;
    }
  }, [isRecording]);

  if (webglError) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center bg-black/30 backdrop-blur-xl"
        style={{ aspectRatio: '16/10' }}
        data-testid="sign-avatar-container"
      >
        <div className="text-center px-8">
          <p className="text-white/40 text-sm mb-2">3D avatar unavailable</p>
          <p className="text-white/20 text-xs">{webglError}</p>
          {currentWord && (
            <p className="text-white/60 text-lg uppercase tracking-widest mt-4 font-bold">{currentWord}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black/25 backdrop-blur-sm"
      style={{ aspectRatio: '16/10' }}
      data-testid="sign-avatar-container"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        data-testid="sign-avatar-canvas"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mb-3 mx-auto" />
            <p className="text-white/40 text-sm">Loading avatar...</p>
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        {isRecording ? (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            <span className="text-xs font-semibold text-white/70 tracking-widest uppercase">Live ASL</span>
          </>
        ) : (
          <span className="text-xs text-white/25 tracking-wider uppercase">Ready</span>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl pointer-events-none" data-testid="subtitle-area">
        {(finalResult || interimResult) ? (
          <div
            className="px-5 py-2.5 rounded-lg text-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            data-testid="subtitle-text"
          >
            <p className="text-sm md:text-base text-white font-medium leading-relaxed">
              {finalResult && <span>{finalResult}</span>}
              {finalResult && interimResult && <span> </span>}
              {interimResult && <span className="text-white/50 italic">{interimResult}</span>}
            </p>
          </div>
        ) : !isRecording && !loading ? (
          <p className="text-white/20 text-sm text-center">
            Speak to see the avatar sign in real-time ASL
          </p>
        ) : null}
      </div>
    </div>
  );
}

function waitMs(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}
