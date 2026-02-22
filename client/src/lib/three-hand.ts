import * as THREE from 'three';
import type { HandPose, FaceExpression } from './asl-poses';

// ─────────────────────────────────────────────────────────────
// Shared materials (created once, reused across instances)
// ─────────────────────────────────────────────────────────────
const SKIN_BASE   = new THREE.Color(0xf2b889);
const SKIN_LIGHT  = new THREE.Color(0xfad4ac);
const SKIN_SHADOW = new THREE.Color(0xd99060);
const NAIL_COL    = new THREE.Color(0xfce8d4);
const HAIR_COL    = new THREE.Color(0x2b1a0f);
const LIP_COL     = new THREE.Color(0xc96868);
const EYE_WHITE   = new THREE.Color(0xffffff);
const IRIS_COL    = new THREE.Color(0x4a7bb5);
const PUPIL_COL   = new THREE.Color(0x100808);

function makeSkinMat(col: THREE.Color, rough = 0.7): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: col,
    roughness: rough,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.85,
    sheen: 0.15,
    sheenRoughness: 0.9,
    sheenColor: new THREE.Color(0xff8866),
  });
}

// ─────────────────────────────────────────────────────────────
// Finger proportions (real-world scale in metres)
// ─────────────────────────────────────────────────────────────
// lengths: [metacarpal, proximal, middle, distal]
const SEG_LENGTHS: Record<string, [number, number, number, number]> = {
  thumb:  [0.05, 0.042, 0.032, 0.026],
  index:  [0.06, 0.075, 0.048, 0.032],
  middle: [0.06, 0.082, 0.054, 0.034],
  ring:   [0.06, 0.077, 0.052, 0.032],
  pinky:  [0.05, 0.058, 0.036, 0.026],
};

const SEG_RADIUS: Record<string, [number, number, number, number]> = {
  // [metacarpal, proximal, middle, distal]
  thumb:  [0.0105, 0.0105, 0.0095, 0.0080],
  index:  [0.0090, 0.0095, 0.0085, 0.0072],
  middle: [0.0090, 0.0098, 0.0088, 0.0074],
  ring:   [0.0085, 0.0093, 0.0082, 0.0070],
  pinky:  [0.0075, 0.0078, 0.0068, 0.0058],
};

// MCP base positions on the palm surface (from palm centre)
const MCP_POS: Record<string, [number, number, number]> = {
  thumb:  [-0.085,  0.015, 0.008],
  index:  [-0.050,  0.092, 0.000],
  middle: [-0.008,  0.100, 0.000],
  ring:   [ 0.035,  0.093, 0.000],
  pinky:  [ 0.074,  0.079, 0.000],
};

// Resting flex (x) and splay (z) for each finger's MCP group
const REST_FLEX: Record<string, number> = {
  thumb: -0.12, index: 0.04, middle: 0.01, ring: -0.02, pinky: -0.05,
};

const REST_SPLAY: Record<string, number> = {
  thumb: -0.60, index: -0.13, middle: 0.00, ring: 0.11, pinky: 0.22,
};

// ─────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────
function makeCapsule(r: number, len: number, segs = 5, radSegs = 10): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len, segs, radSegs);
  // Capsule origin is centred; shift so base is at y=0
  g.translate(0, len / 2 + r, 0);
  return g;
}

function makeSphere(r: number, w = 10, h = 8): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, w, h);
}

function makeNail(r: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r * 1.1, r * 1.0, 0.003, 12, 1);
  g.rotateX(Math.PI / 2); // face forward
  return g;
}

// ─────────────────────────────────────────────────────────────
// Per-finger skeleton
// ─────────────────────────────────────────────────────────────
interface FingerJoints {
  metacarpal: THREE.Group;   // attached to palm
  mcp: THREE.Group;          // rotates at MCP
  pip: THREE.Group;          // rotates at PIP
  dip: THREE.Group;          // rotates at DIP
  tipNail: THREE.Mesh;
}

function buildFinger(name: string, mat: THREE.Material, nailMat: THREE.Material): FingerJoints {
  const [metaL, proxL, midL, distL] = SEG_LENGTHS[name];
  const [, proxR, midR, distR] = SEG_RADIUS[name];

  // Phalanx meshes using CapsuleGeometry (rounded ends)
  const proxMesh = new THREE.Mesh(makeCapsule(proxR, proxL), mat);
  const midMesh  = new THREE.Mesh(makeCapsule(midR,  midL ), mat);
  const distMesh = new THREE.Mesh(makeCapsule(distR, distL), mat);

  // Joint knuckle spheres
  const mcpKnuckle = new THREE.Mesh(makeSphere(proxR * 1.15), mat);
  const pipKnuckle = new THREE.Mesh(makeSphere(midR  * 1.10), mat);
  const dipKnuckle = new THREE.Mesh(makeSphere(distR * 1.05), mat);

  // Nail
  const tipNail = new THREE.Mesh(makeNail(distR * 1.05), nailMat);
  tipNail.position.set(0, distL + distR * 1.8, distR * 0.9);

  // DIP joint group – rotates at DIP
  const dip = new THREE.Group();
  dip.position.set(0, midL + midR * 2, 0);
  dip.add(dipKnuckle, distMesh, tipNail);

  // PIP joint group – rotates at PIP
  const pip = new THREE.Group();
  pip.position.set(0, proxL + proxR * 2, 0);
  pip.add(pipKnuckle, midMesh, dip);

  // MCP joint group – rotates at MCP (bend + splay)
  const mcp = new THREE.Group();
  mcp.add(mcpKnuckle, proxMesh, pip);

  // Metacarpal bone (positioned in palm, connects to MCP)
  const metacarpal = new THREE.Group();
  metacarpal.add(mcp);

  return { metacarpal, mcp, pip, dip, tipNail };
}

// ─────────────────────────────────────────────────────────────
// HandModel
// ─────────────────────────────────────────────────────────────
export class HandModel {
  public root: THREE.Group;
  private wrist: THREE.Group;
  private joints: Record<string, FingerJoints>;
  private isLeft: boolean;
  private mat: THREE.Material;
  private nailMat: THREE.Material;

  constructor(isLeft = false) {
    this.isLeft = isLeft;
    this.root  = new THREE.Group();
    this.wrist = new THREE.Group();
    this.root.add(this.wrist);

    this.mat     = makeSkinMat(SKIN_BASE);
    this.nailMat = makeSkinMat(NAIL_COL, 0.45);

    // ── Palm ──
    // Shape: wide, thin, slightly rounded via bevelling subdivisions
    const palmGeo = new THREE.BoxGeometry(0.192, 0.210, 0.052, 4, 5, 2);
    const palm    = new THREE.Mesh(palmGeo, this.mat);
    palm.position.y = -0.01; // slight offset so palm centre aligns with fingers
    this.wrist.add(palm);

    // Thumb heel (metacarpal pad)
    const thumbPadGeo = new THREE.CapsuleGeometry(0.018, 0.035, 4, 10);
    thumbPadGeo.rotateZ(Math.PI / 2.5);
    const thumbPad = new THREE.Mesh(thumbPadGeo, this.mat);
    thumbPad.position.set(isLeft ? 0.085 : -0.085, -0.018, 0.005);
    this.wrist.add(thumbPad);

    // Wrist knob
    const wristGeo = new THREE.CapsuleGeometry(0.022, 0.06, 4, 10);
    wristGeo.rotateZ(Math.PI / 2);
    const wristMesh = new THREE.Mesh(wristGeo, makeSkinMat(SKIN_SHADOW, 0.75));
    wristMesh.position.y = -0.12;
    this.wrist.add(wristMesh);

    // ── Fingers ──
    this.joints = {};
    const names = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    names.forEach(n => {
      const f = buildFinger(n, this.mat, this.nailMat);
      this.joints[n] = f;

      let [ox, oy, oz] = MCP_POS[n];
      if (isLeft) ox = -ox;
      f.metacarpal.position.set(ox, oy, oz);
      f.mcp.rotation.x = REST_FLEX[n];
      f.mcp.rotation.z = isLeft ? -REST_SPLAY[n] : REST_SPLAY[n];
      this.wrist.add(f.metacarpal);
    });

    if (isLeft) this.root.scale.x = -1;
  }

  // ─── Public API ────────────────────────────────────────────

  applyPose(pose: HandPose): void {
    this._setPose(pose, 1);
  }

  lerpToPose(pose: HandPose, t: number): void {
    this._setPose(pose, t);
  }

  private _setPose(pose: HandPose, t: number): void {
    this._applyFinger('index',  pose.index.curl,  pose.index.spread,  t);
    this._applyFinger('middle', pose.middle.curl, pose.middle.spread, t);
    this._applyFinger('ring',   pose.ring.curl,   pose.ring.spread,   t);
    this._applyFinger('pinky',  pose.pinky.curl,  pose.pinky.spread,  t);
    this._applyThumb(pose.thumb.flex, pose.thumb.abd, t);

    const lerpR = (cur: number, tgt: number) => cur + (tgt - cur) * t;
    this.wrist.rotation.x = lerpR(this.wrist.rotation.x, pose.wristX ?? 0);
    this.wrist.rotation.y = lerpR(this.wrist.rotation.y, pose.wristY ?? 0);
    this.wrist.rotation.z = lerpR(this.wrist.rotation.z, pose.wristZ ?? 0);
  }

  private _applyFinger(name: string, curl: number, spread: number, t: number): void {
    const f = this.joints[name];
    // MCP bends 40%, PIP 38%, DIP 22% of total curl
    const maxFlex = Math.PI * 0.88;
    const maxSplay = 0.28;

    const tgtMCPx = REST_FLEX[name]  - curl * maxFlex * 0.40;
    const sign    = this.isLeft ? 1 : -1;
    const baseZ   = this.isLeft ? -REST_SPLAY[name] : REST_SPLAY[name];
    const tgtMCPz = baseZ + sign * spread * maxSplay;
    const tgtPIPx = -curl * maxFlex * 0.38;
    const tgtDIPx = -curl * maxFlex * 0.22;

    const lr = (c: number, d: number) => c + (d - c) * t;
    f.mcp.rotation.x = lr(f.mcp.rotation.x, tgtMCPx);
    f.mcp.rotation.z = lr(f.mcp.rotation.z, tgtMCPz);
    f.pip.rotation.x = lr(f.pip.rotation.x, tgtPIPx);
    f.dip.rotation.x = lr(f.dip.rotation.x, tgtDIPx);
  }

  private _applyThumb(flex: number, abd: number, t: number): void {
    const f = this.joints['thumb'];
    // Thumb has more complex kinematics
    const maxFlex = Math.PI * 0.52;
    const maxAbd  = Math.PI * 0.48;

    const sign    = this.isLeft ? 1 : -1;
    const baseMCPz = this.isLeft ? -REST_SPLAY['thumb'] : REST_SPLAY['thumb'];
    const tgtMCPx = REST_FLEX['thumb'] - flex * maxFlex * 0.35;
    const tgtMCPz = baseMCPz + sign * abd * maxAbd;
    const tgtPIPx = -flex * maxFlex * 0.42;
    const tgtDIPx = -flex * maxFlex * 0.23;

    const lr = (c: number, d: number) => c + (d - c) * t;
    f.mcp.rotation.x = lr(f.mcp.rotation.x, tgtMCPx);
    f.mcp.rotation.z = lr(f.mcp.rotation.z, tgtMCPz);
    f.pip.rotation.x = lr(f.pip.rotation.x, tgtPIPx);
    f.dip.rotation.x = lr(f.dip.rotation.x, tgtDIPx);
  }

  dispose(): void {
    this.mat.dispose();
    this.nailMat.dispose();
    this.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────
// FaceModel – production-quality head for ASL avatar
// ─────────────────────────────────────────────────────────────
export class FaceModel {
  public root: THREE.Group;

  // Animated parts
  private leftBrow:  THREE.Group;
  private rightBrow: THREE.Group;
  private upperLip:  THREE.Mesh;
  private lowerLip:  THREE.Mesh;
  private leftLid:   THREE.Mesh;
  private rightLid:  THREE.Mesh;
  private leftCheek: THREE.Mesh;
  private rightCheek: THREE.Mesh;

  constructor() {
    this.root = new THREE.Group();

    const skinMat  = makeSkinMat(SKIN_BASE);
    const skinDark = makeSkinMat(SKIN_SHADOW, 0.8);
    const whiteMat = new THREE.MeshPhysicalMaterial({ color: EYE_WHITE, roughness: 0.15, clearcoat: 0.3 });
    const irisMat  = new THREE.MeshPhysicalMaterial({ color: IRIS_COL,  roughness: 0.1,  clearcoat: 0.5 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: PUPIL_COL, roughness: 0.4 });
    const browMat  = new THREE.MeshStandardMaterial({ color: HAIR_COL,  roughness: 0.7 });
    const hairMat  = new THREE.MeshStandardMaterial({ color: HAIR_COL,  roughness: 0.75 });
    const lipMat   = new THREE.MeshPhysicalMaterial({ color: LIP_COL,   roughness: 0.45, clearcoat: 0.2 });
    const lashMat  = new THREE.MeshStandardMaterial({ color: 0x100808,  roughness: 0.9 });

    // ── Head / Skull ──────────────────────────────────────
    const headGeo = new THREE.SphereGeometry(0.195, 28, 22);
    headGeo.scale(1.0, 1.22, 0.96);
    const head = new THREE.Mesh(headGeo, skinMat);
    this.root.add(head);

    // Cheekbones (slight bulge)
    const ckGeo = new THREE.SphereGeometry(0.072, 10, 8);
    this.leftCheek  = new THREE.Mesh(ckGeo, skinMat);
    this.rightCheek = new THREE.Mesh(ckGeo.clone(), skinMat);
    this.leftCheek.position.set( -0.118, -0.032, 0.135);
    this.rightCheek.position.set(  0.118, -0.032, 0.135);
    this.leftCheek.scale.set(0.55, 0.55, 0.55);
    this.rightCheek.scale.set(0.55, 0.55, 0.55);
    this.root.add(this.leftCheek, this.rightCheek);

    // ── Ears ──────────────────────────────────────────────
    const earGeo = new THREE.CapsuleGeometry(0.022, 0.048, 3, 8);
    const lEar = new THREE.Mesh(earGeo, skinDark);
    lEar.position.set(-0.198, 0.008, 0.01);
    lEar.rotation.z = 0.25;
    const rEar = new THREE.Mesh(earGeo.clone(), skinDark);
    rEar.position.set( 0.198, 0.008, 0.01);
    rEar.rotation.z = -0.25;
    // Inner ear concha
    const conchaGeo = new THREE.TorusGeometry(0.012, 0.006, 6, 10);
    const lConcha = new THREE.Mesh(conchaGeo, skinDark);
    lConcha.position.set(-0.197, 0.008, 0.016);
    const rConcha = new THREE.Mesh(conchaGeo.clone(), skinDark);
    rConcha.position.set( 0.197, 0.008, 0.016);
    this.root.add(lEar, rEar, lConcha, rConcha);

    // ── Jaw / Chin ────────────────────────────────────────
    const jawGeo = new THREE.SphereGeometry(0.11, 14, 10);
    jawGeo.scale(1.0, 0.65, 0.90);
    const jaw = new THREE.Mesh(jawGeo, skinMat);
    jaw.position.set(0, -0.175, 0.04);
    this.root.add(jaw);

    // ── Nose ──────────────────────────────────────────────
    const noseRootGeo = new THREE.SphereGeometry(0.028, 10, 8);
    noseRootGeo.scale(0.75, 1.2, 1.0);
    const noseRoot = new THREE.Mesh(noseRootGeo, skinMat);
    noseRoot.position.set(0, -0.010, 0.185);
    this.root.add(noseRoot);

    // Nose tip
    const noseTipGeo = new THREE.SphereGeometry(0.022, 10, 8);
    noseTipGeo.scale(1.1, 0.8, 1.0);
    const noseTip = new THREE.Mesh(noseTipGeo, skinMat);
    noseTip.position.set(0, -0.042, 0.196);
    this.root.add(noseTip);

    // Nostrils
    [-0.018, 0.018].forEach(x => {
      const nGeo = new THREE.SphereGeometry(0.012, 8, 6);
      nGeo.scale(1, 0.7, 1);
      const n = new THREE.Mesh(nGeo, skinDark);
      n.position.set(x, -0.050, 0.186);
      this.root.add(n);
    });

    // ── Eyes ──────────────────────────────────────────────
    const eyePositions: [number, number][] = [[-0.068, 1], [0.068, -1]];
    eyePositions.forEach(([x]) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(x, 0.032, 0.165);

      // Sclera (white)
      const scleraGeo = new THREE.SphereGeometry(0.0340, 14, 11);
      const sclera = new THREE.Mesh(scleraGeo, whiteMat);
      eyeGroup.add(sclera);

      // Iris (coloured ring)
      const irisGeo = new THREE.SphereGeometry(0.0215, 12, 10);
      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.z = 0.016;
      eyeGroup.add(iris);

      // Pupil (dark centre)
      const pupilGeo = new THREE.SphereGeometry(0.0130, 10, 8);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.z = 0.024;
      eyeGroup.add(pupil);

      // Corneal highlight
      const hiGeo = new THREE.SphereGeometry(0.004, 6, 5);
      const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const hi = new THREE.Mesh(hiGeo, hiMat);
      hi.position.set(0.008, 0.008, 0.032);
      eyeGroup.add(hi);

      this.root.add(eyeGroup);
    });

    // ── Upper Eyelids ──────────────────────────────────────
    const makeLid = (x: number): THREE.Mesh => {
      const lidGeo = new THREE.SphereGeometry(0.036, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52);
      const lid = new THREE.Mesh(lidGeo, skinMat);
      lid.position.set(x, 0.032, 0.168);
      lid.rotation.x = -0.08;
      lid.scale.y = 0.18;
      return lid;
    };
    this.leftLid  = makeLid(-0.068);
    this.rightLid = makeLid( 0.068);
    this.root.add(this.leftLid, this.rightLid);

    // Eyelash strips
    [-0.068, 0.068].forEach(x => {
      const lashGeo = new THREE.BoxGeometry(0.048, 0.003, 0.002);
      const lash = new THREE.Mesh(lashGeo, lashMat);
      lash.position.set(x, 0.050, 0.170);
      lash.rotation.x = -0.12;
      this.root.add(lash);
    });

    // ── Eyebrows ──────────────────────────────────────────
    const makeBrow = (x: number): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(x, 0.090, 0.158);

      // Arch shape: two capsule segments
      const seg1Geo = new THREE.CapsuleGeometry(0.0055, 0.030, 3, 8);
      seg1Geo.rotateZ(Math.PI / 2 + 0.18);
      const seg1 = new THREE.Mesh(seg1Geo, browMat);
      seg1.position.set(-0.015, 0, 0);

      const seg2Geo = new THREE.CapsuleGeometry(0.0045, 0.022, 3, 8);
      seg2Geo.rotateZ(Math.PI / 2 - 0.22);
      const seg2 = new THREE.Mesh(seg2Geo, browMat);
      seg2.position.set( 0.017, 0.004, 0);

      g.add(seg1, seg2);
      return g;
    };
    this.leftBrow  = makeBrow(-0.068);
    this.rightBrow = makeBrow( 0.068);
    this.root.add(this.leftBrow, this.rightBrow);

    // ── Lips ──────────────────────────────────────────────
    // Upper lip (M-curve shape via capsule)
    const upperLipGeo = new THREE.CapsuleGeometry(0.0105, 0.050, 4, 10);
    upperLipGeo.rotateZ(Math.PI / 2);
    upperLipGeo.scale(1, 0.7, 1.1);
    this.upperLip = new THREE.Mesh(upperLipGeo, lipMat);
    this.upperLip.position.set(0, -0.074, 0.172);
    this.root.add(this.upperLip);

    // Lower lip (fuller)
    const lowerLipGeo = new THREE.CapsuleGeometry(0.0115, 0.052, 4, 10);
    lowerLipGeo.rotateZ(Math.PI / 2);
    lowerLipGeo.scale(1, 0.85, 1.1);
    this.lowerLip = new THREE.Mesh(lowerLipGeo, lipMat);
    this.lowerLip.position.set(0, -0.090, 0.171);
    this.root.add(this.lowerLip);

    // Lip corners
    [-0.030, 0.030].forEach(x => {
      const cGeo = new THREE.SphereGeometry(0.007, 7, 6);
      const c = new THREE.Mesh(cGeo, lipMat);
      c.position.set(x, -0.082, 0.170);
      this.root.add(c);
    });

    // Philtrum indent (small shadow above upper lip)
    const philGeo = new THREE.SphereGeometry(0.010, 6, 5);
    philGeo.scale(0.6, 1.2, 0.6);
    const phil = new THREE.Mesh(philGeo, skinDark);
    phil.position.set(0, -0.060, 0.180);
    this.root.add(phil);

    // ── Hair cap ──────────────────────────────────────────
    const hairCapGeo = new THREE.SphereGeometry(0.200, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    hairCapGeo.scale(1.0, 1.22, 0.95);
    const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
    hairCap.position.y = 0.020;
    this.root.add(hairCap);

    // Hair sides / temples
    [-0.17, 0.17].forEach(x => {
      const sideGeo = new THREE.CapsuleGeometry(0.055, 0.08, 3, 10);
      const side = new THREE.Mesh(sideGeo, hairMat);
      side.position.set(x, 0.05, -0.02);
      side.rotation.z = x < 0 ? 0.35 : -0.35;
      this.root.add(side);
    });

    // Neck start (blend to body)
    const neckGeo = new THREE.CylinderGeometry(0.042, 0.052, 0.065, 12);
    const neck = new THREE.Mesh(neckGeo, makeSkinMat(SKIN_BASE, 0.8));
    neck.position.y = -0.238;
    this.root.add(neck);
  }

  applyExpression(expr: FaceExpression): void {
    this._doExpr(expr, 1);
  }

  lerpExpression(expr: FaceExpression, t: number): void {
    this._doExpr(expr, t);
  }

  private _doExpr(e: FaceExpression, t: number): void {
    const lr = (c: number, d: number) => c + (d - c) * t;

    // ── Eyebrows ──
    const targetBrowY = 0.090 + (e.eyebrowRaise) * 0.028;
    this.leftBrow.position.y  = lr(this.leftBrow.position.y,  targetBrowY);
    this.rightBrow.position.y = lr(this.rightBrow.position.y, targetBrowY);
    const browTilt = (e.eyebrowRaise) * 0.12;
    this.leftBrow.rotation.z  = lr(this.leftBrow.rotation.z,  -browTilt);
    this.rightBrow.rotation.z = lr(this.rightBrow.rotation.z,   browTilt);

    // ── Eyelids (blink / squint) ──
    const sqt = Math.max(0, e.eyeSquint ?? 0);
    const tgtLidY = 0.18 + sqt * 0.72;
    this.leftLid.scale.y  = lr(this.leftLid.scale.y,  tgtLidY);
    this.rightLid.scale.y = lr(this.rightLid.scale.y, tgtLidY);

    // ── Lips – open / smile ──
    const openOffset = (e.mouthOpen) * 0.014;
    this.upperLip.position.y = lr(this.upperLip.position.y, -0.074 + openOffset * 0.4);
    this.lowerLip.position.y = lr(this.lowerLip.position.y, -0.090 - openOffset);
    const smileSX = 1 + (e.mouthSmile) * 0.42;
    this.upperLip.scale.x = lr(this.upperLip.scale.x, smileSX);
    this.lowerLip.scale.x = lr(this.lowerLip.scale.x, smileSX);

    // ── Cheeks (puff) ──
    const puff = e.cheekPuff ?? 0;
    const cks  = 0.55 + puff * 0.55;
    this.leftCheek.scale.x  = lr(this.leftCheek.scale.x,  cks);
    this.leftCheek.scale.y  = lr(this.leftCheek.scale.y,  cks);
    this.leftCheek.scale.z  = lr(this.leftCheek.scale.z,  cks);
    this.rightCheek.scale.x = lr(this.rightCheek.scale.x, cks);
    this.rightCheek.scale.y = lr(this.rightCheek.scale.y, cks);
    this.rightCheek.scale.z = lr(this.rightCheek.scale.z, cks);

    // ── Head tilt ──
    this.root.rotation.x = lr(this.root.rotation.x, e.headTiltX ?? 0);
    this.root.rotation.y = lr(this.root.rotation.y, e.headTiltY ?? 0);
  }

  dispose(): void {
    this.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m: THREE.Material) => m.dispose());
        else (obj.material as THREE.Material).dispose();
      }
    });
  }
}
