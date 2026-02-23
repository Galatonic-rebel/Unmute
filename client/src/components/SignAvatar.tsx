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
  left:  HandPose;
  face?: FaceExpression;
  holdMs: number;
}

// ─── Hand world-space rest positions ──────────────────────────────────────────
// Right hand: signer's RIGHT hand = viewer's LEFT  (x < 0)
// Left  hand: signer's LEFT  hand = viewer's RIGHT (x > 0)
// With MCP_POS having thumb at local x=-0.068 (outer) and pinky at +0.060 (inner
// when viewed from the palm side), placing the right hand at x=-0.26 means:
//   thumb  world x = -0.26 - 0.068 = -0.328  (outer/leftward)
//   pinky  world x = -0.26 + 0.060 = -0.200  (inner/rightward toward centre) ✓
const REST_R = { x: -0.26, y: -0.08, z: 0.18 };
const REST_L = { x:  0.26, y: -0.08, z: 0.18 };

// Idle hand resting poses (relaxed natural, slight inward wrist rotation)
const IDLE_RIGHT: HandPose = {
  thumb:  { flex: 0.1, abd: 0.5 },
  index:  { curl: 0.15, spread: -0.05 },
  middle: { curl: 0.15, spread: 0 },
  ring:   { curl: 0.18, spread: 0.05 },
  pinky:  { curl: 0.22, spread: 0.08 },
  wristY: -0.12,   // slight inward rotation: right palm faces mildly toward centre
};
// Left hand uses the same values; scale.x=-1 on the root mirrors wristY visually
const IDLE_LEFT: HandPose = { ...IDLE_RIGHT, wristY: 0.12 };

export function SignAvatar({ currentWord, isRecording, signQueue }: SignAvatarProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rightHandRef = useRef<HandModel | null>(null);
  const leftHandRef  = useRef<HandModel | null>(null);
  const faceRef      = useRef<FaceModel | null>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef       = useRef<number>(0);
  const [webglError, setWebglError] = useState<string | null>(null);

  const queueRef          = useRef<QueueItem[]>([]);
  const currentItemRef    = useRef<QueueItem | null>(null);
  const itemStartRef      = useRef<number>(0);
  const blinkTimerRef     = useRef<number>(0);
  const nextBlinkRef      = useRef<number>(2800 + Math.random() * 3000);
  const prevSignQueueRef  = useRef<string[] | undefined>(undefined);

  // ─── Build Three.js scene ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    let rh: HandModel;
    let lh: HandModel;
    let face: FaceModel;
    let ro: ResizeObserver;

    try {
      // ── Renderer ───────────────────────────────────────────────────────
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
      renderer.shadowMap.enabled   = true;
      renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace    = THREE.SRGBColorSpace;
      renderer.toneMapping         = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      rendererRef.current = renderer;

      const w = Math.max(canvas.clientWidth, 320);
      const h = Math.max(canvas.clientHeight, 200);
      renderer.setSize(w, h, false);

      // ── Scene ──────────────────────────────────────────────────────────
      const scene = new THREE.Scene();

      // Rich dark background gradient via a large hemisphere
      const bgSphereGeo = new THREE.SphereGeometry(6, 16, 10);
      bgSphereGeo.scale(-1, -1, -1); // invert normals
      const bgMat = new THREE.MeshBasicMaterial({
        vertexColors: true,
      });
      // Colour gradient: top = deep blue, bottom = near black
      const bgPositions = bgSphereGeo.attributes.position;
      const bgColors: number[] = [];
      for (let i = 0; i < bgPositions.count; i++) {
        const y = bgPositions.getY(i);
        // y in [-6, 6]: blend top → rich navy, bottom → near black
        const t = (y / 6 + 1) / 2; // 0 = bottom, 1 = top
        bgColors.push(
          0.04 + t * 0.06,  // r
          0.05 + t * 0.09,  // g
          0.08 + t * 0.16,  // b
        );
      }
      bgSphereGeo.setAttribute('color', new THREE.Float32BufferAttribute(bgColors, 3));
      scene.add(new THREE.Mesh(bgSphereGeo, bgMat));

      // ── Camera ─────────────────────────────────────────────────────────
      // Hair cap top world-y ≈ 0.75 (face root 0.50 + cap 0.25).
      // FOV 46 at z = 1.90 gives visible half-height ≈ 0.80 above/below
      // the lookAt centre (y=0.30), so full range 0.30±0.80 = [-0.50 … 1.10].
      // That comfortably fits the hair top (0.75) and resting hands (-0.08).
      const camera = new THREE.PerspectiveCamera(46, w / h, 0.01, 20);
      camera.position.set(0, 0.30, 1.90);
      camera.lookAt(0, 0.30, 0);

      // ── Lighting ───────────────────────────────────────────────────────
      // Warm hemisphere (sky + ground)
      scene.add(new THREE.HemisphereLight(0xfff4e0, 0x1a1a2e, 0.38));

      // Key light – warm, soft, from upper-left
      const key = new THREE.DirectionalLight(0xffe8c0, 1.55);
      key.position.set(-0.5, 1.8, 1.6);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 0.1;
      key.shadow.camera.far  = 10;
      key.shadow.camera.left = key.shadow.camera.bottom = -1;
      key.shadow.camera.right = key.shadow.camera.top = 1;
      key.shadow.radius = 5;
      key.shadow.bias   = -0.0005;
      scene.add(key);

      // Fill light – cool, softer, from right
      const fill = new THREE.DirectionalLight(0xb0d8ff, 0.55);
      fill.position.set(1.5, 0.4, 0.8);
      scene.add(fill);

      // Rim / hair light – warm from behind-above
      const rim = new THREE.DirectionalLight(0xffc060, 0.45);
      rim.position.set(0, 0.8, -2.5);
      scene.add(rim);

      // Under fill – violet glow from below (like a stage)
      const under = new THREE.DirectionalLight(0x8060ff, 0.18);
      under.position.set(0, -2, 0.5);
      scene.add(under);

      // ── Ground plane (shadow catcher) ─────────────────────────────────
      const groundGeo = new THREE.PlaneGeometry(4, 4);
      const groundMat = new THREE.ShadowMaterial({ opacity: 0.18 });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.55;
      ground.receiveShadow = true;
      scene.add(ground);

      // ── Body / Torso ──────────────────────────────────────────────────
      // Shirt (dark navy/teal)
      const shirtMat = new THREE.MeshPhysicalMaterial({
        color: 0x1a2b3d, roughness: 0.88, metalness: 0.0,
        clearcoat: 0.02, clearcoatRoughness: 0.9,
      });
      // Torso body
      const torsoGeo = new THREE.CapsuleGeometry(0.155, 0.32, 5, 14);
      const torso = new THREE.Mesh(torsoGeo, shirtMat);
      torso.position.set(0, -0.19, -0.06);
      torso.castShadow = torso.receiveShadow = true;
      scene.add(torso);

      // Shoulder bar (makes it look broader)
      const shoulderGeo = new THREE.CapsuleGeometry(0.068, 0.64, 4, 12);
      shoulderGeo.rotateZ(Math.PI / 2);
      const shoulders = new THREE.Mesh(shoulderGeo, shirtMat);
      shoulders.position.set(0, 0.12, -0.05);
      shoulders.castShadow = true;
      scene.add(shoulders);

      // Collar highlight
      const collarGeo = new THREE.TorusGeometry(0.052, 0.010, 8, 20);
      const collarMat = new THREE.MeshPhysicalMaterial({ color: 0x243548, roughness: 0.7 });
      const collar = new THREE.Mesh(collarGeo, collarMat);
      collar.position.set(0, 0.28, 0.02);
      collar.rotation.x = -0.15;
      scene.add(collar);

      // (Arms removed — hands-only display)

      // ── Face ──────────────────────────────────────────────────────────
      face = new FaceModel();
      face.root.position.set(0, 0.50, 0.01);
      face.root.scale.setScalar(0.95);
      // Face casts shadows on the scene but does NOT receive them —
      // receiveShadow on the head sphere causes the forehead to
      // self-shadow the eye area with a dark band artifact.
      face.root.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = false; } });
      scene.add(face.root);
      faceRef.current = face;
      face.applyExpression(NEUTRAL_FACE);

      // ── Hands ─────────────────────────────────────────────────────────
      // Signer's right hand (HandModel isLeft=false) → viewer's LEFT (x < 0)
      rh = new HandModel(false);
      rh.root.position.set(REST_R.x, REST_R.y, REST_R.z);
      rh.root.rotation.set(0.06, -0.12, 0);
      rh.root.traverse(c => { if (c instanceof THREE.Mesh) c.castShadow = true; });
      rh.applyPose(IDLE_RIGHT);
      scene.add(rh.root);
      rightHandRef.current = rh;

      // Signer's left hand (HandModel isLeft=true) → viewer's RIGHT (x > 0)
      lh = new HandModel(true);
      lh.root.position.set(REST_L.x, REST_L.y, REST_L.z);
      lh.root.rotation.set(0.06,  0.12, 0);
      lh.root.traverse(c => { if (c instanceof THREE.Mesh) c.castShadow = true; });
      lh.applyPose(IDLE_LEFT);
      scene.add(lh.root);
      leftHandRef.current = lh;

      // ── Resize observer ───────────────────────────────────────────────
      ro = new ResizeObserver(() => {
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        if (!cw || !ch) return;
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
      });
      ro.observe(canvas);

      // ── Animation loop ────────────────────────────────────────────────
      let prev = performance.now();
      const animate = (now: number) => {
        rafRef.current = requestAnimationFrame(animate);
        const dt = Math.min(now - prev, 50);
        prev = now;

        const rHand = rightHandRef.current;
        const lHand = leftHandRef.current;
        const fc    = faceRef.current;
        if (!rHand || !lHand || !fc) return;

        // Advance sign queue
        if (!currentItemRef.current && queueRef.current.length > 0) {
          currentItemRef.current = queueRef.current.shift()!;
          itemStartRef.current   = now;
        }

        // Helper: lerp a single number
        const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;

        const cur = currentItemRef.current;
        if (cur) {
          // Lerp speed: fast approach (snappy but smooth)
          const lerpT = Math.min(dt / 65, 1);
          rHand.lerpToPose(cur.right, lerpT);
          lHand.lerpToPose(cur.left,  lerpT);
          fc.lerpExpression(cur.face ?? NEUTRAL_FACE, lerpT);

          // Lerp hand world positions toward target (REST + pose offset)
          const posT = Math.min(dt / 70, 1);
          const rTargX = REST_R.x + (cur.right.posX ?? 0);
          const rTargY = REST_R.y + (cur.right.posY ?? 0);
          const rTargZ = REST_R.z + (cur.right.posZ ?? 0);
          rHand.root.position.x = lerpN(rHand.root.position.x, rTargX, posT);
          rHand.root.position.y = lerpN(rHand.root.position.y, rTargY, posT);
          rHand.root.position.z = lerpN(rHand.root.position.z, rTargZ, posT);

          const lTargX = REST_L.x + (cur.left.posX ?? 0);
          const lTargY = REST_L.y + (cur.left.posY ?? 0);
          const lTargZ = REST_L.z + (cur.left.posZ ?? 0);
          lHand.root.position.x = lerpN(lHand.root.position.x, lTargX, posT);
          lHand.root.position.y = lerpN(lHand.root.position.y, lTargY, posT);
          lHand.root.position.z = lerpN(lHand.root.position.z, lTargZ, posT);

          if (now - itemStartRef.current >= cur.holdMs) {
            currentItemRef.current = null;
          }
        } else {
          // Gentle return to idle with subtle organic sway
          const idleT = Math.min(dt / 220, 1);
          rHand.lerpToPose(IDLE_RIGHT, idleT);
          lHand.lerpToPose(IDLE_LEFT,  idleT);
          fc.lerpExpression(NEUTRAL_FACE, idleT);

          // Subtle breathing / sway motion
          const ts = now * 0.0006;
          const sway = Math.sin(ts) * 0.018;
          const rise = Math.sin(ts * 0.72) * 0.006;

          // Return positions to rest, then apply sway on top
          const posRetT = Math.min(dt / 180, 1);
          rHand.root.position.x = lerpN(rHand.root.position.x, REST_R.x, posRetT);
          rHand.root.position.y = lerpN(rHand.root.position.y, REST_R.y + rise, posRetT);
          rHand.root.position.z = lerpN(rHand.root.position.z, REST_R.z, posRetT);
          lHand.root.position.x = lerpN(lHand.root.position.x, REST_L.x, posRetT);
          lHand.root.position.y = lerpN(lHand.root.position.y, REST_L.y + Math.sin(ts * 0.72 + 1.2) * 0.006, posRetT);
          lHand.root.position.z = lerpN(lHand.root.position.z, REST_L.z, posRetT);

          rHand.root.rotation.y = -0.12 + sway * 0.8;
          lHand.root.rotation.y =  0.12 - sway * 0.8;

          // Subtle head micro-movements
          face.root.rotation.y = Math.sin(ts * 0.3) * 0.015;
          face.root.rotation.x = Math.sin(ts * 0.5) * 0.008;
        }

        // Auto blink
        blinkTimerRef.current += dt;
        if (blinkTimerRef.current >= nextBlinkRef.current) {
          blinkTimerRef.current = 0;
          nextBlinkRef.current  = 2500 + Math.random() * 4500;
          // Double blink occasionally
          const doDouble = Math.random() < 0.2;
          fc.applyExpression({ ...NEUTRAL_FACE, eyeSquint: 1 });
          setTimeout(() => {
            fc.applyExpression(NEUTRAL_FACE);
            if (doDouble) {
              setTimeout(() => {
                fc.applyExpression({ ...NEUTRAL_FACE, eyeSquint: 1 });
                setTimeout(() => fc.applyExpression(NEUTRAL_FACE), 90);
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
    }

    return () => {
      if (ro!) ro.disconnect();
      cancelAnimationFrame(rafRef.current);
      if (rh!)       { rh.dispose();       rightHandRef.current = null; }
      if (lh!)       { lh.dispose();       leftHandRef.current  = null; }
      if (face!)     { face.dispose();     faceRef.current      = null; }
      if (renderer!) { renderer.dispose(); rendererRef.current  = null; }
    };
  }, []);

  // ─── Sign queue from finalized speech ─────────────────────────────────
  useEffect(() => {
    if (!signQueue?.length || signQueue === prevSignQueueRef.current) return;
    prevSignQueueRef.current = signQueue;
    queueRef.current         = [];
    currentItemRef.current   = null;
    signQueue.forEach(word => {
      queueRef.current.push(...wordToSignQueue(word));
    });
  }, [signQueue]);

  // ─── Reset on recording stop ───────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) {
      queueRef.current       = [];
      currentItemRef.current = null;
    }
  }, [isRecording]);

  // ─── Error fallback ────────────────────────────────────────────────────
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

  // ─── Main render ───────────────────────────────────────────────────────
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

      {/* Recording badge */}
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

      {/* Current word badge */}
      {currentWord && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full border border-white/12"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)' }}
          data-testid="current-word-badge"
        >
          <span className="text-sm font-bold text-white tracking-widest uppercase">{currentWord}</span>
        </div>
      )}

      {/* Branding */}
      <div className="absolute top-3 right-3 text-[10px] text-white/18 font-mono tracking-wider select-none">
        3D · ASL
      </div>

      {/* Idle prompt */}
      {!isRecording && !currentWord && (
        <div className="absolute inset-0 flex items-end justify-center pb-10 pointer-events-none">
          <p className="text-white/18 text-sm text-center px-8 leading-relaxed">
            Speak to see the avatar sign in real-time ASL
          </p>
        </div>
      )}
    </div>
  );
}
