import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AvatarController } from '@/lib/avatar-model';
import { wordToSignQueue, NEUTRAL_FACE, OPEN, type FaceExpression, type HandPose } from '@/lib/asl-poses';

interface SignAvatarProps {
  currentWord: string;
  isRecording: boolean;
  signQueue?: string[];
}

interface QueueItem {
  right: HandPose;
  left:  HandPose;
  face?: FaceExpression;
  holdMs: number;
}

const IDLE_RIGHT: HandPose = {
  thumb:  { flex: 0.1, abd: 0.5 },
  index:  { curl: 0.15, spread: -0.05 },
  middle: { curl: 0.15, spread: 0 },
  ring:   { curl: 0.18, spread: 0.05 },
  pinky:  { curl: 0.22, spread: 0.08 },
  wristY: -0.12,
};
const IDLE_LEFT: HandPose = { ...IDLE_RIGHT, wristY: 0.12 };

export function SignAvatar({ currentWord, isRecording, signQueue }: SignAvatarProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const avatarRef   = useRef<AvatarController | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef      = useRef<number>(0);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const queueRef          = useRef<QueueItem[]>([]);
  const currentItemRef    = useRef<QueueItem | null>(null);
  const itemStartRef      = useRef<number>(0);
  const blinkTimerRef     = useRef<number>(0);
  const nextBlinkRef      = useRef<number>(2800 + Math.random() * 3000);
  const prevSignQueueRef  = useRef<string[] | undefined>(undefined);

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
          alpha: false,
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

        const bgSphereGeo = new THREE.SphereGeometry(6, 16, 10);
        bgSphereGeo.scale(-1, -1, -1);
        const bgMat = new THREE.MeshBasicMaterial({ vertexColors: true });
        const bgPositions = bgSphereGeo.attributes.position;
        const bgColors: number[] = [];
        for (let i = 0; i < bgPositions.count; i++) {
          const y = bgPositions.getY(i);
          const t = (y / 6 + 1) / 2;
          bgColors.push(
            0.04 + t * 0.06,
            0.05 + t * 0.09,
            0.08 + t * 0.16,
          );
        }
        bgSphereGeo.setAttribute('color', new THREE.Float32BufferAttribute(bgColors, 3));
        scene.add(new THREE.Mesh(bgSphereGeo, bgMat));

        const camera = new THREE.PerspectiveCamera(46, w / h, 0.01, 20);
        camera.position.set(0, 0.30, 1.90);
        camera.lookAt(0, 0.30, 0);

        scene.add(new THREE.HemisphereLight(0xfff4e0, 0x1a1a2e, 0.45));

        const key = new THREE.DirectionalLight(0xffe8c0, 1.65);
        key.position.set(-0.5, 1.8, 1.6);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.near = 0.1;
        key.shadow.camera.far  = 10;
        key.shadow.camera.left = key.shadow.camera.bottom = -1.5;
        key.shadow.camera.right = key.shadow.camera.top = 1.5;
        key.shadow.radius = 5;
        key.shadow.bias   = -0.0005;
        scene.add(key);

        const fill = new THREE.DirectionalLight(0xb0d8ff, 0.6);
        fill.position.set(1.5, 0.4, 0.8);
        scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffc060, 0.5);
        rim.position.set(0, 0.8, -2.5);
        scene.add(rim);

        const under = new THREE.DirectionalLight(0x8060ff, 0.2);
        under.position.set(0, -2, 0.5);
        scene.add(under);

        const groundGeo = new THREE.PlaneGeometry(4, 4);
        const groundMat = new THREE.ShadowMaterial({ opacity: 0.18 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.75;
        ground.receiveShadow = true;
        scene.add(ground);

        avatar = new AvatarController();
        await avatar.load('/avatar.glb');

        if (cancelled) {
          avatar.dispose();
          renderer.dispose();
          return;
        }

        avatar.root.position.y = -1.05;
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

          if (!currentItemRef.current && queueRef.current.length > 0) {
            currentItemRef.current = queueRef.current.shift()!;
            itemStartRef.current   = now;
          }

          const cur = currentItemRef.current;
          if (cur) {
            const lerpT = Math.min(dt / 65, 1);
            av.applyHandPose('right', cur.right, lerpT);
            av.applyHandPose('left', cur.left, lerpT);
            av.applyExpression(cur.face ?? NEUTRAL_FACE, lerpT);

            const posT = Math.min(dt / 70, 1);
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

            if (now - itemStartRef.current >= cur.holdMs) {
              currentItemRef.current = null;
            }
          } else {
            const idleT = Math.min(dt / 220, 1);
            av.applyHandPose('right', IDLE_RIGHT, idleT);
            av.applyHandPose('left', IDLE_LEFT, idleT);
            av.applyExpression(NEUTRAL_FACE, idleT);
            av.resetArms(idleT);
            av.applySway(now);
          }

          blinkTimerRef.current += dt;
          if (blinkTimerRef.current >= nextBlinkRef.current) {
            blinkTimerRef.current = 0;
            nextBlinkRef.current  = 2500 + Math.random() * 4500;
            const doDouble = Math.random() < 0.2;
            av.applyExpression({ ...NEUTRAL_FACE, eyeSquint: 1 }, 1);
            setTimeout(() => {
              av.applyExpression(NEUTRAL_FACE, 1);
              if (doDouble) {
                setTimeout(() => {
                  av.applyExpression({ ...NEUTRAL_FACE, eyeSquint: 1 }, 1);
                  setTimeout(() => av.applyExpression(NEUTRAL_FACE, 1), 90);
                }, 180);
              }
            }, 105);
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
      if (ro) ro.disconnect();
      if (avatarRef.current) { avatarRef.current.dispose(); avatarRef.current = null; }
      if (rendererRef.current) { rendererRef.current.dispose(); rendererRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!signQueue?.length || signQueue === prevSignQueueRef.current) return;
    prevSignQueueRef.current = signQueue;
    queueRef.current         = [];
    currentItemRef.current   = null;
    signQueue.forEach(word => {
      queueRef.current.push(...wordToSignQueue(word));
    });
  }, [signQueue]);

  useEffect(() => {
    if (!isRecording) {
      queueRef.current       = [];
      currentItemRef.current = null;
    }
  }, [isRecording]);

  if (webglError) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center"
        style={{ aspectRatio: '16/10', background: 'linear-gradient(160deg, #0d1825 0%, #0a0f1a 100%)' }}
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
      className="relative w-full rounded-2xl overflow-hidden border border-white/10"
      style={{ aspectRatio: '16/10', background: '#0a0f1a' }}
      data-testid="sign-avatar-container"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        data-testid="sign-avatar-canvas"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1a]">
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
            <span className="text-xs font-semibold text-white/65 tracking-widest uppercase">Live ASL</span>
          </>
        ) : (
          <span className="text-xs text-white/22 tracking-wider uppercase">Ready</span>
        )}
      </div>

      {currentWord && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full border border-white/12"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)' }}
          data-testid="current-word-badge"
        >
          <span className="text-sm font-bold text-white tracking-widest uppercase">{currentWord}</span>
        </div>
      )}

      <div className="absolute top-3 right-3 text-[10px] text-white/18 font-mono tracking-wider select-none">
        3D · ASL
      </div>

      {!isRecording && !currentWord && !loading && (
        <div className="absolute inset-0 flex items-end justify-center pb-10 pointer-events-none">
          <p className="text-white/18 text-sm text-center px-8 leading-relaxed">
            Speak to see the avatar sign in real-time ASL
          </p>
        </div>
      )}
    </div>
  );
}
