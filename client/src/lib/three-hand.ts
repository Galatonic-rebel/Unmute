import * as THREE from 'three';
import type { HandPose, FaceExpression } from './asl-poses';

// ─────────────────────────────────────────────────────────────
// Color palette – warm natural skin tone
// ─────────────────────────────────────────────────────────────
const SKIN_MID    = new THREE.Color(0xeca882);  // main skin
const SKIN_LIGHT  = new THREE.Color(0xf5c9a8);  // highlights (palm, inner fingers)
const SKIN_DARK   = new THREE.Color(0xc4845a);  // shadow (knuckles, joints, sole)
const NAIL_COL    = new THREE.Color(0xfde0d0);  // pinkish nail plate
const HAIR_COL    = new THREE.Color(0x2c1a10);  // dark brown hair
const LIP_COL     = new THREE.Color(0xc86868);  // lip color
const EYE_WHITE   = new THREE.Color(0xfefefe);
const IRIS_COL    = new THREE.Color(0x4a72aa);
const PUPIL_COL   = new THREE.Color(0x0e0808);

// ─────────────────────────────────────────────────────────────
// Material helpers
// ─────────────────────────────────────────────────────────────
function makeSkinMat(col: THREE.Color, rough = 0.68): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: col,
    roughness: rough,
    metalness: 0,
    clearcoat: 0.20,
    clearcoatRoughness: 0.78,
    sheen: 0.22,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color(0xff6644),  // warm blood-flush tint
  });
}

function makeSkinMatLt(col: THREE.Color): THREE.MeshPhysicalMaterial {
  return makeSkinMat(col, 0.60);  // slightly shinier for palm/inner areas
}

// ─────────────────────────────────────────────────────────────
// Finger proportions – anatomically based (metres)
// lengths: [proximal phalanx, middle phalanx, distal phalanx]
// ─────────────────────────────────────────────────────────────
const SEG_LENGTHS: Record<string, [number, number, number]> = {
  thumb:  [0.040, 0.030, 0.024],
  index:  [0.072, 0.048, 0.030],
  middle: [0.080, 0.055, 0.033],
  ring:   [0.075, 0.052, 0.031],
  pinky:  [0.055, 0.034, 0.024],
};

// radii at base of each phalanx [proximal, middle, distal]
const SEG_RADII: Record<string, [number, number, number]> = {
  thumb:  [0.0112, 0.0098, 0.0084],
  index:  [0.0098, 0.0086, 0.0074],
  middle: [0.0102, 0.0090, 0.0077],
  ring:   [0.0095, 0.0083, 0.0071],
  pinky:  [0.0080, 0.0068, 0.0058],
};

// MCP attachment points on palm (x, y, z) – right-hand reference
const MCP_POS: Record<string, [number, number, number]> = {
  thumb:  [-0.082,  0.028, 0.006],
  index:  [-0.048,  0.092, 0.002],
  middle: [-0.006,  0.102, 0.002],
  ring:   [ 0.036,  0.094, 0.002],
  pinky:  [ 0.073,  0.080, 0.002],
};

// Natural resting flex (negative = curl toward palm)
const REST_FLEX: Record<string, number> = {
  thumb: -0.10, index: 0.05, middle: 0.02, ring: -0.02, pinky: -0.06,
};

// Natural resting splay (spread between fingers)
const REST_SPLAY: Record<string, number> = {
  thumb: -0.55, index: -0.12, middle: 0.00, ring: 0.10, pinky: 0.21,
};

// ─────────────────────────────────────────────────────────────
// Geometry helpers – no BoxGeometry anywhere!
// ─────────────────────────────────────────────────────────────

// Rounded cylinder (capsule with base at y=0, top at y=length)
function capsule(r: number, len: number, radSegs = 14, capSegs = 4): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(r, len, capSegs, radSegs);
  g.translate(0, len / 2 + r, 0);  // shift base to y=0
  return g;
}

// Tapered round segment: wide at base, narrow at tip, with round cap at top
// Simulates a phalanx bone with skin (thicker base, tapered distal end)
function taperedSegment(
  rBase: number, rTip: number, length: number, radSegs = 14
): THREE.BufferGeometry {
  // Use a higher-resolution capsule at the average radius, then apply scale
  // This gives a subtly tapered look without geometry merging
  const avgR = (rBase + rTip) / 2;
  const g = new THREE.CapsuleGeometry(avgR, length, 4, radSegs);
  g.translate(0, length / 2 + avgR, 0);

  // Scale vertices to create taper: y=0 (base) → rBase/avgR, y=top → rTip/avgR
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const totalH = length + avgR * 2;
    const t = Math.max(0, Math.min(1, y / totalH));
    const scaleXZ = (1 - t) * (rBase / avgR) + t * (rTip / avgR);
    pos.setX(i, pos.getX(i) * scaleXZ);
    pos.setZ(i, pos.getZ(i) * scaleXZ);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function sphere(r: number, wSeg = 12, hSeg = 10): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, wSeg, hSeg);
}

// ─────────────────────────────────────────────────────────────
// Finger joints structure
// ─────────────────────────────────────────────────────────────
interface FingerJoints {
  metacarpal: THREE.Group;
  mcp: THREE.Group;
  pip: THREE.Group;
  dip: THREE.Group;
}

function buildFinger(
  name: string,
  skinMat: THREE.Material,
  knuckleMat: THREE.Material,
  nailMat: THREE.Material
): FingerJoints {
  const [proxL, midL, distL] = SEG_LENGTHS[name];
  const [proxR, midR, distR] = SEG_RADII[name];

  // ── Phalanx segments (tapered) ──
  const proxMesh = new THREE.Mesh(taperedSegment(proxR, proxR * 0.92, proxL), skinMat);
  const midMesh  = new THREE.Mesh(taperedSegment(midR,  midR  * 0.91, midL),  skinMat);
  const distMesh = new THREE.Mesh(taperedSegment(distR, distR * 0.82, distL), skinMat);

  // ── Joint knuckle spheres (slightly flattened on dorsal side) ──
  const mcpKnuckle = new THREE.Mesh(sphere(proxR * 1.22, 12, 9), knuckleMat);
  const pipKnuckle = new THREE.Mesh(sphere(midR  * 1.18, 10, 8), knuckleMat);
  const dipKnuckle = new THREE.Mesh(sphere(distR * 1.12, 10, 8), knuckleMat);

  // ── Fingertip pad (fleshy bulge at fingertip) ──
  const tipPadGeo = new THREE.SphereGeometry(distR * 1.05, 12, 8);
  tipPadGeo.scale(1.0, 0.85, 1.15);  // slightly forward-bulging
  const tipPad = new THREE.Mesh(tipPadGeo, skinMat);
  tipPad.position.set(0, distL + distR * 1.55, distR * 0.12);

  // ── Nail plate (curved, sits on dorsal fingertip) ──
  const nailGeo = new THREE.SphereGeometry(distR * 1.02, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.45);
  nailGeo.rotateX(Math.PI * 0.5);  // face forward-up
  nailGeo.scale(0.9, 0.55, 1.0);
  const nail = new THREE.Mesh(nailGeo, nailMat);
  nail.position.set(0, distL + distR * 1.62, -distR * 0.3);

  // ── DIP group ──
  const dip = new THREE.Group();
  dip.position.set(0, midL + midR * 2.1, 0);
  dip.add(dipKnuckle, distMesh, tipPad, nail);

  // ── PIP group ──
  const pip = new THREE.Group();
  pip.position.set(0, proxL + proxR * 2.1, 0);
  pip.add(pipKnuckle, midMesh, dip);

  // ── MCP group ──
  const mcp = new THREE.Group();
  mcp.add(mcpKnuckle, proxMesh, pip);

  // ── Metacarpal group (parent, positioned on palm) ──
  const metacarpal = new THREE.Group();
  metacarpal.add(mcp);

  return { metacarpal, mcp, pip, dip };
}

// ─────────────────────────────────────────────────────────────
// Organic palm builder – no BoxGeometry!
// Constructed from overlapping ellipsoids that mimic real anatomy
// ─────────────────────────────────────────────────────────────
function buildOrganicPalm(
  isLeft: boolean,
  skinMat: THREE.Material,
  skinLightMat: THREE.Material,
  skinDarkMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  // For right hand: thumb (thenar) on negative x side
  // scale.x = -1 handles left hand mirroring

  // ── 1. Main palm body – oblate ellipsoid (the fundamental slab) ──
  const mainGeo = new THREE.SphereGeometry(1, 28, 22);
  mainGeo.scale(0.102, 0.128, 0.031);
  const main = new THREE.Mesh(mainGeo, skinMat);
  main.position.set(0, 0.015, 0);
  g.add(main);

  // ── 2. Thenar eminence – the prominent muscle mound at thumb base ──
  // This is the MOST important feature for making a hand look like a hand
  const thenarGeo = new THREE.SphereGeometry(1, 18, 14);
  thenarGeo.scale(0.066, 0.095, 0.040);
  const thenar = new THREE.Mesh(thenarGeo, skinMat);
  thenar.position.set(-0.060, 0.025, 0.010);
  g.add(thenar);

  // Thenar upper lobe (extending toward thumb MCP)
  const thenarUpGeo = new THREE.SphereGeometry(1, 14, 10);
  thenarUpGeo.scale(0.040, 0.062, 0.032);
  const thenarUp = new THREE.Mesh(thenarUpGeo, skinMat);
  thenarUp.position.set(-0.072, 0.060, 0.008);
  g.add(thenarUp);

  // ── 3. Hypothenar eminence – pinky-side roll ──
  const hypoGeo = new THREE.SphereGeometry(1, 16, 12);
  hypoGeo.scale(0.042, 0.105, 0.035);
  const hypo = new THREE.Mesh(hypoGeo, skinMat);
  hypo.position.set(0.068, 0.005, 0.008);
  g.add(hypo);

  // ── 4. Metacarpal pad – dorsal ridge where fingers meet palm ──
  const padGeo = new THREE.SphereGeometry(1, 20, 14);
  padGeo.scale(0.100, 0.044, 0.028);
  const pad = new THREE.Mesh(padGeo, skinMat);
  pad.position.set(0.010, 0.086, 0.012);
  g.add(pad);

  // ── 5. Individual metacarpal head pads (4 bumps at finger bases) ──
  const mcpBases = [
    [-0.048, 0.092, 0.014],  // index
    [-0.007, 0.102, 0.014],  // middle
    [ 0.034, 0.093, 0.013],  // ring
    [ 0.072, 0.078, 0.012],  // pinky
  ] as [number, number, number][];

  mcpBases.forEach(([x, y, z]) => {
    const bGeo = new THREE.SphereGeometry(0.022, 12, 9);
    bGeo.scale(1.0, 0.70, 0.88);
    const bump = new THREE.Mesh(bGeo, skinMat);
    bump.position.set(x, y, z);
    g.add(bump);
  });

  // ── 6. Finger webbing – thin membranes between finger bases ──
  const webbingPairs = [
    [[-0.048, 0.092], [-0.007, 0.102]],  // index-middle
    [[-0.007, 0.102], [ 0.034, 0.093]],  // middle-ring
    [[ 0.034, 0.093], [ 0.072, 0.078]],  // ring-pinky
  ] as [[number, number], [number, number]][];

  webbingPairs.forEach(([[x1, y1], [x2, y2]]) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const wGeo = new THREE.SphereGeometry(1, 10, 8);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    wGeo.scale(len * 0.55, 0.018, 0.020);  // thin flat wedge
    const angle = Math.atan2(dy, dx);
    wGeo.rotateZ(angle);
    const web = new THREE.Mesh(wGeo, skinLightMat);
    web.position.set(mx, my - 0.005, 0.008);
    g.add(web);
  });

  // ── 7. Palm center pad (lighter area in palm hollow) ──
  const palmHollowGeo = new THREE.SphereGeometry(1, 14, 10);
  palmHollowGeo.scale(0.062, 0.068, 0.025);
  const palmHollow = new THREE.Mesh(palmHollowGeo, skinLightMat);
  palmHollow.position.set(-0.010, 0.030, 0.020);
  g.add(palmHollow);

  // ── 8. Palm heel (carpal pad – bottom of palm near wrist) ──
  const heelGeo = new THREE.SphereGeometry(1, 14, 10);
  heelGeo.scale(0.058, 0.042, 0.030);
  const heel = new THREE.Mesh(heelGeo, skinMat);
  heel.position.set(0, -0.065, 0.005);
  g.add(heel);

  // ── 9. Wrist – smooth cylindrical band ──
  const wristGeo = new THREE.CapsuleGeometry(0.024, 0.058, 4, 16);
  wristGeo.rotateZ(Math.PI / 2);
  const wrist = new THREE.Mesh(wristGeo, skinDarkMat);
  wrist.position.set(0, -0.122, 0);
  g.add(wrist);

  // Wrist styloid bump (rounded bone prominence)
  const styloidGeo = new THREE.SphereGeometry(0.013, 10, 8);
  const styloid = new THREE.Mesh(styloidGeo, skinDarkMat);
  styloid.position.set(-0.026, -0.118, 0.008);
  g.add(styloid);

  return g;
}

// ─────────────────────────────────────────────────────────────
// HandModel – fully organic 3D hand
// ─────────────────────────────────────────────────────────────
export class HandModel {
  public root: THREE.Group;
  private palmGroup: THREE.Group;
  private joints: Record<string, FingerJoints>;
  private isLeft: boolean;
  private mats: THREE.Material[];

  constructor(isLeft = false) {
    this.isLeft = isLeft;
    this.root    = new THREE.Group();
    this.mats    = [];

    // Skin materials
    const skinMat      = makeSkinMat(SKIN_MID);
    const skinLightMat = makeSkinMatLt(SKIN_LIGHT);
    const skinDarkMat  = makeSkinMat(SKIN_DARK, 0.75);
    const knuckleMat   = makeSkinMat(SKIN_DARK, 0.72);   // slightly darker knuckles
    const nailMat      = new THREE.MeshPhysicalMaterial({
      color: NAIL_COL, roughness: 0.30, metalness: 0.02,
      clearcoat: 0.55, clearcoatRoughness: 0.35,
    });
    this.mats.push(skinMat, skinLightMat, skinDarkMat, knuckleMat, nailMat);

    // ── Palm ──
    this.palmGroup = buildOrganicPalm(isLeft, skinMat, skinLightMat, skinDarkMat);
    this.root.add(this.palmGroup);

    // ── Fingers ──
    this.joints = {};
    const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];

    fingerNames.forEach(name => {
      const f = buildFinger(name, skinMat, knuckleMat, nailMat);
      this.joints[name] = f;

      let [ox, oy, oz] = MCP_POS[name];
      if (isLeft) ox = -ox;

      f.metacarpal.position.set(ox, oy, oz);
      f.mcp.rotation.x = REST_FLEX[name];
      f.mcp.rotation.z = isLeft ? -REST_SPLAY[name] : REST_SPLAY[name];
      this.palmGroup.add(f.metacarpal);
    });

    // Mirror for left hand – single scale flip, everything else symmetric
    if (isLeft) this.root.scale.x = -1;
  }

  // ─── Public pose API ───────────────────────────────────────

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

    const lr = (c: number, d: number) => c + (d - c) * t;
    this.palmGroup.rotation.x = lr(this.palmGroup.rotation.x, pose.wristX ?? 0);
    this.palmGroup.rotation.y = lr(this.palmGroup.rotation.y, pose.wristY ?? 0);
    this.palmGroup.rotation.z = lr(this.palmGroup.rotation.z, pose.wristZ ?? 0);
  }

  private _applyFinger(name: string, curl: number, spread: number, t: number): void {
    const f = this.joints[name];
    const maxFlex = Math.PI * 0.88;
    const maxSplay = 0.28;

    const tgtMCPx = REST_FLEX[name] - curl * maxFlex * 0.38;
    const sign    = this.isLeft ? 1 : -1;
    const baseZ   = this.isLeft ? -REST_SPLAY[name] : REST_SPLAY[name];
    const tgtMCPz = baseZ + sign * spread * maxSplay;
    const tgtPIPx = -curl * maxFlex * 0.40;
    const tgtDIPx = -curl * maxFlex * 0.22;

    const lr = (c: number, d: number) => c + (d - c) * t;
    f.mcp.rotation.x = lr(f.mcp.rotation.x, tgtMCPx);
    f.mcp.rotation.z = lr(f.mcp.rotation.z, tgtMCPz);
    f.pip.rotation.x = lr(f.pip.rotation.x, tgtPIPx);
    f.dip.rotation.x = lr(f.dip.rotation.x, tgtDIPx);
  }

  private _applyThumb(flex: number, abd: number, t: number): void {
    const f = this.joints['thumb'];
    const maxFlex = Math.PI * 0.52;
    const maxAbd  = Math.PI * 0.48;

    const sign    = this.isLeft ? 1 : -1;
    const baseZ   = this.isLeft ? -REST_SPLAY['thumb'] : REST_SPLAY['thumb'];
    const tgtMCPx = REST_FLEX['thumb'] - flex * maxFlex * 0.35;
    const tgtMCPz = baseZ + sign * abd * maxAbd;
    const tgtPIPx = -flex * maxFlex * 0.42;
    const tgtDIPx = -flex * maxFlex * 0.23;

    const lr = (c: number, d: number) => c + (d - c) * t;
    f.mcp.rotation.x = lr(f.mcp.rotation.x, tgtMCPx);
    f.mcp.rotation.z = lr(f.mcp.rotation.z, tgtMCPz);
    f.pip.rotation.x = lr(f.pip.rotation.x, tgtPIPx);
    f.dip.rotation.x = lr(f.dip.rotation.x, tgtDIPx);
  }

  dispose(): void {
    this.mats.forEach(m => m.dispose());
    this.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
  }
}

// ─────────────────────────────────────────────────────────────
// FaceModel – production-quality head for ASL avatar
// ─────────────────────────────────────────────────────────────
export class FaceModel {
  public root: THREE.Group;

  private leftBrow:    THREE.Group;
  private rightBrow:   THREE.Group;
  private upperLip:    THREE.Mesh;
  private lowerLip:    THREE.Mesh;
  private leftLid:     THREE.Mesh;
  private rightLid:    THREE.Mesh;
  private leftCheek:   THREE.Mesh;
  private rightCheek:  THREE.Mesh;

  constructor() {
    this.root = new THREE.Group();

    const skinMat  = makeSkinMat(SKIN_MID);
    const skinDark = makeSkinMat(SKIN_DARK, 0.80);
    const skinLt   = makeSkinMatLt(SKIN_LIGHT);
    const whiteMat = new THREE.MeshPhysicalMaterial({
      color: EYE_WHITE, roughness: 0.12, clearcoat: 0.35,
    });
    const irisMat  = new THREE.MeshPhysicalMaterial({
      color: IRIS_COL,  roughness: 0.08, clearcoat: 0.55,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: PUPIL_COL, roughness: 0.40,
    });
    const browMat  = new THREE.MeshStandardMaterial({ color: HAIR_COL,  roughness: 0.70 });
    const hairMat  = new THREE.MeshStandardMaterial({ color: HAIR_COL,  roughness: 0.78 });
    const lipMat   = new THREE.MeshPhysicalMaterial({
      color: LIP_COL, roughness: 0.42, clearcoat: 0.25,
    });
    const lashMat  = new THREE.MeshStandardMaterial({ color: 0x100808, roughness: 0.90 });

    // ── Head / Skull ──────────────────────────────────────
    const headGeo = new THREE.SphereGeometry(0.192, 32, 26);
    headGeo.scale(1.0, 1.24, 0.95);
    const head = new THREE.Mesh(headGeo, skinMat);
    this.root.add(head);

    // ── Cheekbones ──────────────────────────────────────
    const ckGeo = new THREE.SphereGeometry(0.075, 12, 9);
    this.leftCheek  = new THREE.Mesh(ckGeo, skinMat);
    this.rightCheek = new THREE.Mesh(ckGeo.clone(), skinMat);
    this.leftCheek.position.set( -0.120, -0.034, 0.130);
    this.rightCheek.position.set(  0.120, -0.034, 0.130);
    this.leftCheek.scale.set(0.52, 0.52, 0.52);
    this.rightCheek.scale.set(0.52, 0.52, 0.52);
    this.root.add(this.leftCheek, this.rightCheek);

    // ── Ears ──────────────────────────────────────────────
    const earGeo = new THREE.CapsuleGeometry(0.024, 0.050, 4, 10);
    const lEar = new THREE.Mesh(earGeo, skinDark);
    lEar.position.set(-0.196, 0.010, 0.012);
    lEar.rotation.z = 0.22;
    const rEar = new THREE.Mesh(earGeo.clone(), skinDark);
    rEar.position.set( 0.196, 0.010, 0.012);
    rEar.rotation.z = -0.22;
    const conchaGeo = new THREE.TorusGeometry(0.013, 0.006, 6, 12);
    const lConcha = new THREE.Mesh(conchaGeo, skinDark);
    lConcha.position.set(-0.196, 0.010, 0.018);
    const rConcha = new THREE.Mesh(conchaGeo.clone(), skinDark);
    rConcha.position.set( 0.196, 0.010, 0.018);
    this.root.add(lEar, rEar, lConcha, rConcha);

    // ── Jaw / Chin ────────────────────────────────────────
    const jawGeo = new THREE.SphereGeometry(0.112, 18, 14);
    jawGeo.scale(1.0, 0.62, 0.90);
    const jaw = new THREE.Mesh(jawGeo, skinMat);
    jaw.position.set(0, -0.180, 0.038);
    this.root.add(jaw);

    // ── Nose ──────────────────────────────────────────────
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
      const n = new THREE.Mesh(nGeo, skinDark);
      n.position.set(x, -0.052, 0.188);
      this.root.add(n);
    });

    // ── Eyes ──────────────────────────────────────────────
    [[-0.068, 1], [0.068, -1]].forEach(([x]) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(x as number, 0.033, 0.166);

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.0340, 16, 13), whiteMat);
      eyeGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0218, 14, 11), irisMat);
      iris.position.z = 0.017;
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0134, 12, 9), pupilMat);
      pupil.position.z = 0.025;
      eyeGroup.add(pupil);

      const hiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 7, 6), hiMat);
      hi.position.set(0.009, 0.009, 0.033);
      eyeGroup.add(hi);

      this.root.add(eyeGroup);
    });

    // ── Upper Eyelids ──────────────────────────────────────
    const makeLid = (x: number): THREE.Mesh => {
      const lidGeo = new THREE.SphereGeometry(0.037, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.54);
      const lid = new THREE.Mesh(lidGeo, skinMat);
      lid.position.set(x, 0.033, 0.169);
      lid.rotation.x = -0.08;
      lid.scale.y = 0.18;
      return lid;
    };
    this.leftLid  = makeLid(-0.068);
    this.rightLid = makeLid( 0.068);
    this.root.add(this.leftLid, this.rightLid);

    [-0.068, 0.068].forEach(x => {
      const lashGeo = new THREE.BoxGeometry(0.050, 0.003, 0.002);
      const lash = new THREE.Mesh(lashGeo, lashMat);
      lash.position.set(x, 0.051, 0.171);
      lash.rotation.x = -0.10;
      this.root.add(lash);
    });

    // ── Eyebrows ──────────────────────────────────────────
    const makeBrow = (x: number): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(x, 0.092, 0.158);

      const s1Geo = new THREE.CapsuleGeometry(0.0055, 0.032, 3, 10);
      s1Geo.rotateZ(Math.PI / 2 + 0.16);
      const s1 = new THREE.Mesh(s1Geo, browMat);
      s1.position.set(-0.014, 0, 0);

      const s2Geo = new THREE.CapsuleGeometry(0.0045, 0.024, 3, 10);
      s2Geo.rotateZ(Math.PI / 2 - 0.20);
      const s2 = new THREE.Mesh(s2Geo, browMat);
      s2.position.set(0.018, 0.004, 0);

      g.add(s1, s2);
      return g;
    };
    this.leftBrow  = makeBrow(-0.068);
    this.rightBrow = makeBrow( 0.068);
    this.root.add(this.leftBrow, this.rightBrow);

    // ── Lips ──────────────────────────────────────────────
    const upperLipGeo = new THREE.CapsuleGeometry(0.0108, 0.052, 4, 12);
    upperLipGeo.rotateZ(Math.PI / 2);
    upperLipGeo.scale(1, 0.68, 1.12);
    this.upperLip = new THREE.Mesh(upperLipGeo, lipMat);
    this.upperLip.position.set(0, -0.075, 0.174);
    this.root.add(this.upperLip);

    const lowerLipGeo = new THREE.CapsuleGeometry(0.0118, 0.054, 4, 12);
    lowerLipGeo.rotateZ(Math.PI / 2);
    lowerLipGeo.scale(1, 0.88, 1.12);
    this.lowerLip = new THREE.Mesh(lowerLipGeo, lipMat);
    this.lowerLip.position.set(0, -0.092, 0.173);
    this.root.add(this.lowerLip);

    [-0.032, 0.032].forEach(x => {
      const cGeo = new THREE.SphereGeometry(0.008, 8, 6);
      const c = new THREE.Mesh(cGeo, lipMat);
      c.position.set(x, -0.083, 0.172);
      this.root.add(c);
    });

    // Philtrum
    const philGeo = new THREE.SphereGeometry(0.011, 8, 6);
    philGeo.scale(0.58, 1.25, 0.58);
    const phil = new THREE.Mesh(philGeo, skinDark);
    phil.position.set(0, -0.062, 0.182);
    this.root.add(phil);

    // ── Hair cap ──────────────────────────────────────────
    const hairCapGeo = new THREE.SphereGeometry(0.198, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56);
    hairCapGeo.scale(1.0, 1.24, 0.96);
    const hairCap = new THREE.Mesh(hairCapGeo, hairMat);
    hairCap.position.y = 0.018;
    this.root.add(hairCap);

    [-0.168, 0.168].forEach(x => {
      const sideGeo = new THREE.CapsuleGeometry(0.056, 0.082, 3, 12);
      const side = new THREE.Mesh(sideGeo, hairMat);
      side.position.set(x, 0.048, -0.020);
      side.rotation.z = x < 0 ? 0.33 : -0.33;
      this.root.add(side);
    });

    // ── Neck ──────────────────────────────────────────────
    const neckGeo = new THREE.CapsuleGeometry(0.044, 0.062, 4, 14);
    const neck = new THREE.Mesh(neckGeo, makeSkinMat(SKIN_MID, 0.80));
    neck.position.y = -0.242;
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

    const tgtBrowY = 0.092 + (e.eyebrowRaise) * 0.028;
    this.leftBrow.position.y  = lr(this.leftBrow.position.y,  tgtBrowY);
    this.rightBrow.position.y = lr(this.rightBrow.position.y, tgtBrowY);
    this.leftBrow.rotation.z  = lr(this.leftBrow.rotation.z,  -(e.eyebrowRaise) * 0.12);
    this.rightBrow.rotation.z = lr(this.rightBrow.rotation.z,   (e.eyebrowRaise) * 0.12);

    const sqt    = Math.max(0, e.eyeSquint ?? 0);
    const tgtLid = 0.18 + sqt * 0.72;
    this.leftLid.scale.y  = lr(this.leftLid.scale.y,  tgtLid);
    this.rightLid.scale.y = lr(this.rightLid.scale.y, tgtLid);

    const openOff = (e.mouthOpen) * 0.014;
    this.upperLip.position.y = lr(this.upperLip.position.y, -0.075 + openOff * 0.4);
    this.lowerLip.position.y = lr(this.lowerLip.position.y, -0.092 - openOff);
    const smileSX = 1 + (e.mouthSmile) * 0.42;
    this.upperLip.scale.x = lr(this.upperLip.scale.x, smileSX);
    this.lowerLip.scale.x = lr(this.lowerLip.scale.x, smileSX);

    const puff = e.cheekPuff ?? 0;
    const cks  = 0.52 + puff * 0.55;
    this.leftCheek.scale.setScalar(lr(this.leftCheek.scale.x, cks));
    this.rightCheek.scale.setScalar(lr(this.rightCheek.scale.x, cks));

    this.root.rotation.x = lr(this.root.rotation.x, e.headTiltX ?? 0);
    this.root.rotation.y = lr(this.root.rotation.y, e.headTiltY ?? 0);
  }

  dispose(): void {
    this.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m: THREE.Material) => m.dispose());
        } else {
          (obj.material as THREE.Material).dispose();
        }
      }
    });
  }
}
