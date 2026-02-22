import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HandModel, FaceModel } from '@/lib/three-hand';
import { wordToSignQueue, NEUTRAL_FACE, OPEN, type FaceExpression, type HandPose } from '@/lib/asl-poses';

interface SignAvatarProps {
  currentWord: string;
  isRecording: boolean;
  signQueue?: string[];
}

interface QueueItem {
  right: HandPose;
  left: HandPose;
  face: FaceExpression;
  holdMs: number;
}

export function SignAvatar({ currentWord, isRecording, signQueue }: SignAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rightHandRef = useRef<HandModel | null>(null);
  const leftHandRef = useRef<HandModel | null>(null);
  const faceRef = useRef<FaceModel | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const [webglError, setWebglError] = useState<string | null>(null);

  const queueRef = useRef<QueueItem[]>([]);
  const currentItemRef = useRef<QueueItem | null>(null);
  const itemStartRef = useRef<number>(0);
  const lastWordRef = useRef<string>('');
  const blinkTimerRef = useRef<number>(0);
  const nextBlinkRef = useRef<number>(3000 + Math.random() * 2000);
  const prevSignQueueRef = useRef<string[] | undefined>(undefined);

  // Build the Three.js scene once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    let rh: HandModel;
    let lh: HandModel;
    let face: FaceModel;
    let ro: ResizeObserver;

    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0d1117);

      const w = Math.max(canvas.clientWidth, 320);
      const h = Math.max(canvas.clientHeight, 200);
      const camera = new THREE.PerspectiveCamera(42, w / h, 0.01, 10);
      camera.position.set(0, 0.18, 1.15);
      camera.lookAt(0, 0.08, 0);

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      renderer.shadowMap.enabled = true;
      rendererRef.current = renderer;

      // Lighting
      scene.add(new THREE.AmbientLight(0xfff5e0, 0.65));
      const key = new THREE.DirectionalLight(0xfff3d0, 1.3);
      key.position.set(0.6, 1.2, 1.5);
      key.castShadow = true;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xd0e8ff, 0.45);
      fill.position.set(-1.2, 0.5, 0.5);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0x8899ff, 0.25);
      rim.position.set(0, -0.5, -2);
      scene.add(rim);

      // Background plane
      const bgGeo = new THREE.PlaneGeometry(4, 4);
      const bgMat = new THREE.MeshStandardMaterial({ color: 0x10181f });
      const bg = new THREE.Mesh(bgGeo, bgMat);
      bg.position.z = -0.6;
      scene.add(bg);

      // Body materials
      const shMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xf0b080, roughness: 0.7 });

      // Torso
      const torsoGeo = new THREE.CapsuleGeometry(0.15, 0.25, 4, 12);
      const torso = new THREE.Mesh(torsoGeo, shMat);
      torso.position.set(0, -0.12, -0.05);
      scene.add(torso);

      // Shoulders
      const shGeo = new THREE.CapsuleGeometry(0.065, 0.6, 4, 12);
      shGeo.rotateZ(Math.PI / 2);
      const shoulders = new THREE.Mesh(shGeo, shMat);
      shoulders.position.set(0, 0.13, -0.04);
      scene.add(shoulders);

      // Neck
      const neckGeo = new THREE.CylinderGeometry(0.038, 0.048, 0.13, 10);
      const neck = new THREE.Mesh(neckGeo, skinMat);
      neck.position.set(0, 0.25, 0);
      scene.add(neck);

      // Face
      face = new FaceModel();
      face.root.position.set(0, 0.47, 0.01);
      scene.add(face.root);
      faceRef.current = face;
      face.applyExpression(NEUTRAL_FACE);

      // Hands
      rh = new HandModel(false);
      rh.root.position.set(0.24, -0.1, 0.12);
      rh.root.rotation.set(0.08, 0.15, 0);
      rh.applyPose(OPEN);
      scene.add(rh.root);
      rightHandRef.current = rh;

      lh = new HandModel(true);
      lh.root.position.set(-0.24, -0.1, 0.12);
      lh.root.rotation.set(0.08, -0.15, 0);
      lh.applyPose(OPEN);
      scene.add(lh.root);
      leftHandRef.current = lh;

      // Resize observer
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

        const rHand = rightHandRef.current;
        const lHand = leftHandRef.current;
        const fc = faceRef.current;
        if (!rHand || !lHand || !fc) return;

        // Advance queue
        if (!currentItemRef.current && queueRef.current.length > 0) {
          currentItemRef.current = queueRef.current.shift()!;
          itemStartRef.current = now;
        }

        const cur = currentItemRef.current;
        if (cur) {
          const elapsed = now - itemStartRef.current;
          const lerpT = Math.min(dt / 70, 1);
          rHand.lerpToPose(cur.right, lerpT);
          lHand.lerpToPose(cur.left, lerpT);
          fc.lerpExpression(cur.face, lerpT);
          if (elapsed >= cur.holdMs) {
            currentItemRef.current = null;
          }
        } else {
          // Idle drift to neutral
          const idleT = Math.min(dt / 250, 1);
          rHand.lerpToPose(OPEN, idleT);
          lHand.lerpToPose(OPEN, idleT);
          fc.lerpExpression(NEUTRAL_FACE, idleT);
          // Gentle sway
          const ts = now * 0.0007;
          rHand.root.rotation.y = 0.15 + Math.sin(ts) * 0.025;
          lHand.root.rotation.y = -0.15 - Math.sin(ts) * 0.025;
          rHand.root.position.y = -0.1 + Math.sin(ts * 0.8) * 0.005;
          lHand.root.position.y = -0.1 + Math.sin(ts * 0.8 + 1) * 0.005;
        }

        // Auto blink
        blinkTimerRef.current += dt;
        if (blinkTimerRef.current >= nextBlinkRef.current) {
          blinkTimerRef.current = 0;
          nextBlinkRef.current = 2500 + Math.random() * 4000;
          fc.applyExpression({ ...NEUTRAL_FACE, eyeSquint: 1 });
          setTimeout(() => { faceRef.current?.applyExpression(NEUTRAL_FACE); }, 110);
        }

        renderer.render(scene, camera);
      };
      rafRef.current = requestAnimationFrame(animate);

    } catch (err) {
      console.error('SignAvatar 3D initialization failed:', err);
      setWebglError(err instanceof Error ? err.message : 'Failed to initialize 3D view');
    }

    return () => {
      if (ro!) ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      if (rh!) { rh.dispose(); rightHandRef.current = null; }
      if (lh!) { lh.dispose(); leftHandRef.current = null; }
      if (face!) { face.dispose(); faceRef.current = null; }
      if (renderer!) { renderer.dispose(); rendererRef.current = null; }
    };
  }, []);

  // Sign finalized words when they arrive
  useEffect(() => {
    if (!signQueue?.length || signQueue === prevSignQueueRef.current) return;
    prevSignQueueRef.current = signQueue;
    queueRef.current = [];
    currentItemRef.current = null;
    signQueue.forEach(word => {
      queueRef.current.push(...wordToSignQueue(word));
    });
  }, [signQueue]);

  // Reset on recording stop
  useEffect(() => {
    if (!isRecording) {
      queueRef.current = [];
      currentItemRef.current = null;
      lastWordRef.current = '';
    }
  }, [isRecording]);

  if (webglError) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center bg-[#0d1117]"
        style={{ aspectRatio: '16/10' }}
        data-testid="sign-avatar-container"
      >
        <div className="text-center px-8">
          <p className="text-white/40 text-sm mb-2">3D avatar unavailable</p>
          <p className="text-white/20 text-xs">{webglError}</p>
          <p className="text-white/30 text-sm mt-4 font-medium">
            {currentWord && <span className="text-white/60 uppercase tracking-widest">{currentWord}</span>}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-white/10"
      style={{ aspectRatio: '16/10', background: '#0d1117' }}
      data-testid="sign-avatar-container"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        data-testid="sign-avatar-canvas"
      />

      {/* Recording indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        {isRecording ? (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-white/60 tracking-widest uppercase">Live ASL</span>
          </>
        ) : (
          <span className="text-xs text-white/25 tracking-wider uppercase">Ready</span>
        )}
      </div>

      {/* Current word display */}
      {currentWord && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full backdrop-blur-md bg-black/50 border border-white/10"
          data-testid="current-word-badge"
        >
          <span className="text-sm font-bold text-white tracking-widest uppercase">{currentWord}</span>
        </div>
      )}

      {/* ASL badge */}
      <div className="absolute top-3 right-3 text-[10px] text-white/20 font-mono tracking-wider">
        3D · ASL
      </div>

      {/* Idle prompt */}
      {!isRecording && !currentWord && (
        <div className="absolute inset-0 flex items-end justify-center pb-10 pointer-events-none">
          <p className="text-white/20 text-sm text-center px-8">
            Start translating to see the 3D avatar sign in real-time
          </p>
        </div>
      )}
    </div>
  );
}
