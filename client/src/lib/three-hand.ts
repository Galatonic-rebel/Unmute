import * as THREE from 'three';
import type { HandPose, FaceExpression } from './asl-poses';

// ─────────────────────────────────────────────────────────────
// Color palette
// ─────────────────────────────────────────────────────────────
const SKIN_MID   = new THREE.Color(0xd4956a);
const SKIN_LIGHT = new THREE.Color(0xe8b98a);
const SKIN_DARK  = new THREE.Color(0xb87348);
const NAIL_COL   = new THREE.Color(0xefd0b8);
const HAIR_COL   = new THREE.Color(0x2c1a10);
const LIP_COL    = new THREE.Color(0xb86060);
const EYE_WHITE  = new THREE.Color(0xfefefe);
const IRIS_COL   = new THREE.Color(0x4a72aa);
const PUPIL_COL  = new THREE.Color(0x0e0808);

// ─────────────────────────────────────────────────────────────
// Materials
// ─────────────────────────────────────────────────────────────
function makeSkinMat(col: THREE.Color, rough = 0.72): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color:              col,
    roughness:          rough,
    metalness:          0,
    clearcoat:          0.15,
    clearcoatRoughness: 0.80,
    sheen:              0.18,
    sheenRoughness:     0.85,
    sheenColor:         new THREE.Color(0xff5533),
  });
}

// ─────────────────────────────────────────────────────────────
// Rounded-box geometry  (single smooth mesh – no visible corners)
// ─────────────────────────────────────────────────────────────
function makeRoundedBox(
  w: number, h: number, d: number,
  radius: number, segs = 7
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, segs * 2, segs * 3, segs);
  const pos = geo.attributes.position;
  const hw = w / 2 - radius;
  const hh = h / 2 - radius;
  const hd = d / 2 - radius;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const cx = Math.max(-hw, Math.min(hw, x));
    const cy = Math.max(-hh, Math.min(hh, y));
    const cz = Math.max(-hd, Math.min(hd, z));
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
    pos.setXYZ(i,
      cx + (dx / len) * radius,
      cy + (dy / len) * radius,
      cz + (dz / len) * radius
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// ─────────────────────────────────────────────────────────────
// Capsule with base at y=0
// ─────────────────────────────────────────────────────────────
function capsule(r: number, len: number, capSegs = 4, radSegs = 18): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len, capSegs, radSegs);
  g.translate(0, len / 2 + r, 0);
  return g;
}

// ─────────────────────────────────────────────────────────────
// Finger anatomy  (lengths & radii in metres)
// ─────────────────────────────────────────────────────────────
const SEG_LENGTHS: Record<string, [number, number, number]> = {
  thumb:  [0.038, 0.028, 0.022],
  index:  [0.068, 0.046, 0.028],
  middle: [0.076, 0.052, 0.032],
  ring:   [0.072, 0.050, 0.030],
  pinky:  [0.052, 0.032, 0.022],
};

const SEG_RADII: Record<string, [number, number, number]> = {
  thumb:  [0.0118, 0.0104, 0.0090],
  index:  [0.0102, 0.0090, 0.0078],
  middle: [0.0108, 0.0096, 0.0082],
  ring:   [0.0100, 0.0088, 0.0076],
  pinky:  [0.0085, 0.0073, 0.0062],
};

// MCP attachment points on palm (right-hand reference)
const MCP_POS: Record<string, [number, number, number]> = {
  thumb:  [-0.080,  0.030, 0.004],
  index:  [-0.046,  0.090, 0.002],
  middle: [-0.005,  0.100, 0.002],
  ring:   [ 0.036,  0.091, 0.002],
  pinky:  [ 0.071,  0.077, 0.002],
};

const REST_FLEX: Record<string, number> = {
  thumb: -0.10, index: 0.04, middle: 0.02, ring: -0.02, pinky: -0.05,
};

const REST_SPLAY: Record<string, number> = {
  thumb: -0.55, index: -0.12, middle: 0.00, ring: 0.10, pinky: 0.21,
};

// ─────────────────────────────────────────────────────────────
// Finger builder – smooth segments, NO separate knuckle spheres
// Segments overlap at joints so rounded ends blend together
// ─────────────────────────────────────────────────────────────
interface FingerJoints {
  metacarpal: THREE.Group;
  mcp:        THREE.Group;
  pip:        THREE.Group;
  dip:        THREE.Group;
}

function buildFinger(
  name: string,
  skinMat: THREE.Material,
  nailMat: THREE.Material
): FingerJoints {
  const [proxL, midL, distL] = SEG_LENGTHS[name];
  const [proxR, midR, distR] = SEG_RADII[name];

  // Each segment is a single capsule – rounded ends naturally form the joint shape
  const proxMesh = new THREE.Mesh(capsule(proxR, proxL), skinMat);
  const midMesh  = new THREE.Mesh(capsule(midR,  midL),  skinMat);
  const distMesh = new THREE.Mesh(capsule(distR, distL), skinMat);

  // ── Nail – thin curved disc on dorsal fingertip ──
  const nailGeo = new THREE.SphereGeometry(distR * 0.98, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42);
  nailGeo.rotateX(Math.PI * 0.5);
  nailGeo.scale(0.88, 0.52, 1.05);
  const nail = new THREE.Mesh(nailGeo, nailMat);
  nail.position.set(0, distL + distR * 1.55, -distR * 0.28);

  // ── DIP – pivot at top of middle phalanx ──
  // Segments overlap by 1×radius so the capsule roundings merge smoothly
  const dip = new THREE.Group();
  dip.position.set(0, midL + midR * 1.05, 0);
  dip.add(distMesh, nail);

  // ── PIP ──
  const pip = new THREE.Group();
  pip.position.set(0, proxL + proxR * 1.05, 0);
  pip.add(midMesh, dip);

  // ── MCP ──
  const mcp = new THREE.Group();
  mcp.add(proxMesh, pip);

  const metacarpal = new THREE.Group();
  metacarpal.add(mcp);

  return { metacarpal, mcp, pip, dip };
}

// ─────────────────────────────────────────────────────────────
// Organic palm  – single rounded-box slab + 2 muscle ellipsoids
// Result: ONE dominant shape with subtle organic bumps; no blob circles
// ─────────────────────────────────────────────────────────────
function buildOrganicPalm(
  skinMat: THREE.Material,
  skinDarkMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();

  // ── 1. Main palm slab – smooth rounded box (the fundamental shape) ──
  const palmGeo = makeRoundedBox(0.200, 0.218, 0.056, 0.020, 7);
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.position.set(0.004, 0.010, 0);
  g.add(palm);

  // ── 2. Thenar eminence – thumb-side muscle (one large ellipsoid) ──
  const thenarGeo = new THREE.SphereGeometry(1, 22, 16);
  thenarGeo.scale(0.052, 0.100, 0.038);
  const thenar = new THREE.Mesh(thenarGeo, skinMat);
  // Positioned so it overlaps the palm slab edge – no gap, no separate blob
  thenar.position.set(-0.068, 0.022, 0.012);
  g.add(thenar);

  // ── 3. Hypothenar eminence – pinky-side roll (subtle) ──
  const hypoGeo = new THREE.SphereGeometry(1, 18, 14);
  hypoGeo.scale(0.036, 0.092, 0.030);
  const hypo = new THREE.Mesh(hypoGeo, skinMat);
  hypo.position.set(0.072, 0.004, 0.008);
  g.add(hypo);

  // ── 4. Wrist transition band ──
  const wristGeo = new THREE.CapsuleGeometry(0.025, 0.060, 4, 16);
  wristGeo.rotateZ(Math.PI / 2);
  const wrist = new THREE.Mesh(wristGeo, skinDarkMat);
  wrist.position.set(0, -0.120, 0);
  g.add(wrist);

  return g;
}

// ─────────────────────────────────────────────────────────────
// HandModel
// ─────────────────────────────────────────────────────────────
export class HandModel {
  public root:       THREE.Group;
  private palmGroup: THREE.Group;
  private joints:    Record<string, FingerJoints>;
  private isLeft:    boolean;
  private mats:      THREE.Material[];

  constructor(isLeft = false) {
    this.isLeft = isLeft;
    this.root   = new THREE.Group();
    this.mats   = [];

    const skinMat     = makeSkinMat(SKIN_MID);
    const skinDarkMat = makeSkinMat(SKIN_DARK, 0.78);
    const nailMat = new THREE.MeshPhysicalMaterial({
      color: NAIL_COL, roughness: 0.28, metalness: 0.02,
      clearcoat: 0.60, clearcoatRoughness: 0.32,
    });
    this.mats.push(skinMat, skinDarkMat, nailMat);

    // Palm (built for right hand; mirrored for left via scale.x = -1)
    this.palmGroup = buildOrganicPalm(skinMat, skinDarkMat);
    this.root.add(this.palmGroup);

    // Fingers
    this.joints = {};
    ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach(name => {
      const f = buildFinger(name, skinMat, nailMat);
      this.joints[name] = f;

      let [ox, oy, oz] = MCP_POS[name];
      if (isLeft) ox = -ox;

      f.metacarpal.position.set(ox, oy, oz);
      f.mcp.rotation.x = REST_FLEX[name];
      f.mcp.rotation.z = isLeft ? -REST_SPLAY[name] : REST_SPLAY[name];
      this.palmGroup.add(f.metacarpal);
    });

    if (isLeft) this.root.scale.x = -1;
  }

  applyPose(pose: HandPose): void  { this._setPose(pose, 1); }
  lerpToPose(pose: HandPose, t: number): void { this._setPose(pose, t); }

  private _setPose(pose: HandPose, t: number): void {
    this._applyFinger('index',  pose.index.curl,  pose.index.spread,  t);
    this._applyFinger('middle', pose.middle.curl, pose.middle.spread, t);
    this._applyFinger('ring',   pose.ring.curl,   pose.ring.spread,   t);
    this._applyFinger('pinky',  pose.pinky.curl,  pose.pinky.spread,  t);
    this._applyThumb(pose.thumb.flex, pose.thumb.abd, t);

    const lr = (c: number, d: number) => c + (d - c) * t;
    this.palmGroup.rotation.x = lr(this.palmGroup.rotation.x, pose.wristX ?? 0);
    this.palmGroup.rotation.y = lr(this.palmGroup.rotation.y, pose.wristY ?? 0);
    this.palmGroup.rotation.z = lr(this.palmGroup.rotation.z, pose.wristZ ?? 0);
  }

  private _applyFinger(name: string, curl: number, spread: number, t: number): void {
    const f        = this.joints[name];
    const maxFlex  = Math.PI * 0.88;
    const maxSplay = 0.28;
    const sign     = this.isLeft ? 1 : -1;
    const baseZ    = this.isLeft ? -REST_SPLAY[name] : REST_SPLAY[name];

    const lr = (c: number, d: number) => c + (d - c) * t;
    f.mcp.rotation.x = lr(f.mcp.rotation.x, REST_FLEX[name] - curl * maxFlex * 0.38);
    f.mcp.rotation.z = lr(f.mcp.rotation.z, baseZ + sign * spread * maxSplay);
    f.pip.rotation.x = lr(f.pip.rotation.x, -curl * maxFlex * 0.40);
    f.dip.rotation.x = lr(f.dip.rotation.x, -curl * maxFlex * 0.22);
  }

  private _applyThumb(flex: number, abd: number, t: number): void {
    const f       = this.joints['thumb'];
    const maxFlex = Math.PI * 0.52;
    const maxAbd  = Math.PI * 0.48;
    const sign    = this.isLeft ? 1 : -1;
    const baseZ   = this.isLeft ? -REST_SPLAY['thumb'] : REST_SPLAY['thumb'];

    const lr = (c: number, d: number) => c + (d - c) * t;
    f.mcp.rotation.x = lr(f.mcp.rotation.x, REST_FLEX['thumb'] - flex * maxFlex * 0.35);
    f.mcp.rotation.z = lr(f.mcp.rotation.z, baseZ + sign * abd * maxAbd);
    f.pip.rotation.x = lr(f.pip.rotation.x, -flex * maxFlex * 0.42);
    f.dip.rotation.x = lr(f.dip.rotation.x, -flex * maxFlex * 0.23);
  }

  dispose(): void {
    this.mats.forEach(m => m.dispose());
    this.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  }
}

// ─────────────────────────────────────────────────────────────
// FaceModel
// ─────────────────────────────────────────────────────────────
export class FaceModel {
  public root: THREE.Group;

  private leftBrow:   THREE.Group;
  private rightBrow:  THREE.Group;
  private upperLip:   THREE.Mesh;
  private lowerLip:   THREE.Mesh;
  private leftLid:    THREE.Mesh;
  private rightLid:   THREE.Mesh;
  private leftCheek:  THREE.Mesh;
  private rightCheek: THREE.Mesh;

  constructor() {
    this.root = new THREE.Group();

    const skinMat  = makeSkinMat(SKIN_MID);
    const skinDark = makeSkinMat(SKIN_DARK, 0.80);
    const whiteMat = new THREE.MeshPhysicalMaterial({ color: EYE_WHITE, roughness: 0.12, clearcoat: 0.35 });
    const irisMat  = new THREE.MeshPhysicalMaterial({ color: IRIS_COL,  roughness: 0.08, clearcoat: 0.55 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: PUPIL_COL, roughness: 0.40 });
    const browMat  = new THREE.MeshStandardMaterial({ color: HAIR_COL,  roughness: 0.70 });
    const hairMat  = new THREE.MeshStandardMaterial({ color: HAIR_COL,  roughness: 0.78 });
    const lipMat   = new THREE.MeshPhysicalMaterial({ color: LIP_COL,   roughness: 0.42, clearcoat: 0.25 });
    const lashMat  = new THREE.MeshStandardMaterial({ color: 0x100808,  roughness: 0.90 });

    // Head
    const headGeo = new THREE.SphereGeometry(0.192, 32, 26);
    headGeo.scale(1.0, 1.24, 0.95);
    this.root.add(new THREE.Mesh(headGeo, skinMat));

    // Cheekbones
    const ckGeo = new THREE.SphereGeometry(0.075, 12, 9);
    this.leftCheek  = new THREE.Mesh(ckGeo,       skinMat);
    this.rightCheek = new THREE.Mesh(ckGeo.clone(), skinMat);
    this.leftCheek.position.set( -0.120, -0.034, 0.130);
    this.rightCheek.position.set(  0.120, -0.034, 0.130);
    this.leftCheek.scale.setScalar(0.52);
    this.rightCheek.scale.setScalar(0.52);
    this.root.add(this.leftCheek, this.rightCheek);

    // Ears
    const earGeo = new THREE.CapsuleGeometry(0.024, 0.050, 4, 10);
    const lEar = new THREE.Mesh(earGeo, skinDark);
    lEar.position.set(-0.196, 0.010, 0.012); lEar.rotation.z = 0.22;
    const rEar = new THREE.Mesh(earGeo.clone(), skinDark);
    rEar.position.set( 0.196, 0.010, 0.012); rEar.rotation.z = -0.22;
    const conchaGeo = new THREE.TorusGeometry(0.013, 0.006, 6, 12);
    const lConcha = new THREE.Mesh(conchaGeo, skinDark);
    lConcha.position.set(-0.196, 0.010, 0.018);
    const rConcha = new THREE.Mesh(conchaGeo.clone(), skinDark);
    rConcha.position.set( 0.196, 0.010, 0.018);
    this.root.add(lEar, rEar, lConcha, rConcha);

    // Jaw
    const jawGeo = new THREE.SphereGeometry(0.112, 18, 14);
    jawGeo.scale(1.0, 0.62, 0.90);
    const jaw = new THREE.Mesh(jawGeo, skinMat);
    jaw.position.set(0, -0.180, 0.038);
    this.root.add(jaw);

    // Nose
    const noseRootGeo = new THREE.SphereGeometry(0.030, 12, 9);
    noseRootGeo.scale(0.70, 1.25, 1.0);
    const noseRoot = new THREE.Mesh(noseRootGeo, skinMat);
    noseRoot.position.set(0, -0.012, 0.186);
    this.root.add(noseRoot);

    const noseTipGeo = new THREE.SphereGeometry(0.024, 12, 9);
    noseTipGeo.scale(1.15, 0.78, 1.05);
    const noseTip = new THREE.Mesh(noseTipGeo, skinMat);
    noseTip.position.set(0, -0.044, 0.197);
    this.root.add(noseTip);

    [-0.018, 0.018].forEach(x => {
      const nGeo = new THREE.SphereGeometry(0.012, 10, 7);
      nGeo.scale(1, 0.65, 1);
      this.root.add(new THREE.Mesh(nGeo, skinDark) );
      const n = this.root.children[this.root.children.length - 1] as THREE.Mesh;
      n.position.set(x, -0.052, 0.188);
    });

    // Eyes
    [[-0.068, 1], [0.068, -1]].forEach(([x]) => {
      const eg = new THREE.Group();
      eg.position.set(x as number, 0.033, 0.166);
      eg.add(new THREE.Mesh(new THREE.SphereGeometry(0.034,  16, 13), whiteMat));
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 11), irisMat);
      iris.position.z = 0.017; eg.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 12, 9), pupilMat);
      pupil.position.z = 0.025; eg.add(pupil);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.004, 7, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hi.position.set(0.009, 0.009, 0.033); eg.add(hi);
      this.root.add(eg);
    });

    // Eyelids
    const makeLid = (x: number): THREE.Mesh => {
      const lg = new THREE.SphereGeometry(0.037, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.54);
      const l = new THREE.Mesh(lg, skinMat);
      l.position.set(x, 0.033, 0.169);
      l.rotation.x = -0.08;
      l.scale.y = 0.18;
      return l;
    };
    this.leftLid  = makeLid(-0.068);
    this.rightLid = makeLid( 0.068);
    this.root.add(this.leftLid, this.rightLid);

    [-0.068, 0.068].forEach(x => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.003, 0.002), lashMat);
      l.position.set(x, 0.051, 0.171); l.rotation.x = -0.10;
      this.root.add(l);
    });

    // Eyebrows
    const makeBrow = (x: number): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(x, 0.092, 0.158);
      const s1g = new THREE.CapsuleGeometry(0.0055, 0.032, 3, 10);
      s1g.rotateZ(Math.PI / 2 + 0.16);
      const s1 = new THREE.Mesh(s1g, browMat);
      s1.position.set(-0.014, 0, 0);
      const s2g = new THREE.CapsuleGeometry(0.0045, 0.024, 3, 10);
      s2g.rotateZ(Math.PI / 2 - 0.20);
      const s2 = new THREE.Mesh(s2g, browMat);
      s2.position.set(0.018, 0.004, 0);
      g.add(s1, s2);
      return g;
    };
    this.leftBrow  = makeBrow(-0.068);
    this.rightBrow = makeBrow( 0.068);
    this.root.add(this.leftBrow, this.rightBrow);

    // Lips
    const ulg = new THREE.CapsuleGeometry(0.0108, 0.052, 4, 12);
    ulg.rotateZ(Math.PI / 2); ulg.scale(1, 0.68, 1.12);
    this.upperLip = new THREE.Mesh(ulg, lipMat);
    this.upperLip.position.set(0, -0.075, 0.174);
    this.root.add(this.upperLip);

    const llg = new THREE.CapsuleGeometry(0.0118, 0.054, 4, 12);
    llg.rotateZ(Math.PI / 2); llg.scale(1, 0.88, 1.12);
    this.lowerLip = new THREE.Mesh(llg, lipMat);
    this.lowerLip.position.set(0, -0.092, 0.173);
    this.root.add(this.lowerLip);

    [-0.032, 0.032].forEach(x => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), lipMat);
      c.position.set(x, -0.083, 0.172);
      this.root.add(c);
    });

    const phil = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), skinDark);
    phil.geometry.scale(0.58, 1.25, 0.58);
    phil.position.set(0, -0.062, 0.182);
    this.root.add(phil);

    // Hair
    const hcg = new THREE.SphereGeometry(0.198, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56);
    hcg.scale(1.0, 1.24, 0.96);
    const hairCap = new THREE.Mesh(hcg, hairMat);
    hairCap.position.y = 0.018;
    this.root.add(hairCap);

    [-0.168, 0.168].forEach(x => {
      const sg = new THREE.CapsuleGeometry(0.056, 0.082, 3, 12);
      const s = new THREE.Mesh(sg, hairMat);
      s.position.set(x, 0.048, -0.020);
      s.rotation.z = x < 0 ? 0.33 : -0.33;
      this.root.add(s);
    });

    // Neck
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.062, 4, 14), makeSkinMat(SKIN_MID, 0.80));
    neck.position.y = -0.242;
    this.root.add(neck);
  }

  applyExpression(expr: FaceExpression): void  { this._doExpr(expr, 1); }
  lerpExpression(expr: FaceExpression, t: number): void { this._doExpr(expr, t); }

  private _doExpr(e: FaceExpression, t: number): void {
    const lr = (c: number, d: number) => c + (d - c) * t;

    const browY = 0.092 + e.eyebrowRaise * 0.028;
    this.leftBrow.position.y  = lr(this.leftBrow.position.y,  browY);
    this.rightBrow.position.y = lr(this.rightBrow.position.y, browY);
    this.leftBrow.rotation.z  = lr(this.leftBrow.rotation.z,  -e.eyebrowRaise * 0.12);
    this.rightBrow.rotation.z = lr(this.rightBrow.rotation.z,   e.eyebrowRaise * 0.12);

    const sqt = Math.max(0, e.eyeSquint ?? 0);
    this.leftLid.scale.y  = lr(this.leftLid.scale.y,  0.18 + sqt * 0.72);
    this.rightLid.scale.y = lr(this.rightLid.scale.y, 0.18 + sqt * 0.72);

    const openOff = e.mouthOpen * 0.014;
    this.upperLip.position.y = lr(this.upperLip.position.y, -0.075 + openOff * 0.4);
    this.lowerLip.position.y = lr(this.lowerLip.position.y, -0.092 - openOff);
    const smileSX = 1 + e.mouthSmile * 0.42;
    this.upperLip.scale.x = lr(this.upperLip.scale.x, smileSX);
    this.lowerLip.scale.x = lr(this.lowerLip.scale.x, smileSX);

    const cks = 0.52 + (e.cheekPuff ?? 0) * 0.55;
    this.leftCheek.scale.setScalar(lr(this.leftCheek.scale.x, cks));
    this.rightCheek.scale.setScalar(lr(this.rightCheek.scale.x, cks));

    this.root.rotation.x = lr(this.root.rotation.x, e.headTiltX ?? 0);
    this.root.rotation.y = lr(this.root.rotation.y, e.headTiltY ?? 0);
  }

  dispose(): void {
    this.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material))
          obj.material.forEach((m: THREE.Material) => m.dispose());
        else (obj.material as THREE.Material).dispose();
      }
    });
  }
}
