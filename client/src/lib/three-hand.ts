import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { HandPose, FaceExpression } from './asl-poses';

// ─── Skin palette ─────────────────────────────────────────────────────────────
const SKIN    = new THREE.Color(0xc8855a);
const SKIN_LT = new THREE.Color(0xdda070);
const SKIN_DK = new THREE.Color(0xa06038);
const NAIL    = new THREE.Color(0xe8c4a8);
const LIP     = new THREE.Color(0xb06060);
const HAIR    = new THREE.Color(0x2a1808);
const EYE_W   = new THREE.Color(0xfdfdfd);
const IRIS    = new THREE.Color(0x3a6090);
const PUPIL   = new THREE.Color(0x0d0608);

// ─── Materials ────────────────────────────────────────────────────────────────
function skinMat(col = SKIN, rough = 0.68) {
  return new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: 0 });
}

const SHARED_SKIN    = skinMat(SKIN,    0.68);
const SHARED_SKIN_DK = skinMat(SKIN_DK, 0.72);
const SHARED_NAIL    = skinMat(NAIL,    0.30);

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Open cylinder + two sphere caps → seamless capsule-like segment.
 *  The geometry base sits at y = 0; tip at y = length.
 */
function makeSegmentGeo(rBase: number, rTip: number, length: number) {
  const RAD = 14;
  const group = new THREE.Group();

  // Cylinder body (open-ended so no flat discs)
  if (length > 0.001) {
    const cylGeo = new THREE.CylinderGeometry(rTip, rBase, length, RAD, 1, true);
    cylGeo.translate(0, length / 2, 0);
    group.add(new THREE.Mesh(cylGeo, SHARED_SKIN));
  }

  // Base hemisphere (spheroid slightly flattened toward palm)
  const botGeo = new THREE.SphereGeometry(rBase, RAD, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  botGeo.translate(0, 0, 0);
  group.add(new THREE.Mesh(botGeo, SHARED_SKIN));

  // Tip hemisphere (full sphere – acts as cap and next-segment overlap)
  const topGeo = new THREE.SphereGeometry(rTip, RAD, 10);
  topGeo.translate(0, length, 0);
  group.add(new THREE.Mesh(topGeo, SHARED_SKIN));

  return group;
}

// ─── Finger anatomy constants ─────────────────────────────────────────────────
// Each finger: [proxLength, midLength, distLength]  (metres)
const F_LEN: Record<string, [number, number, number]> = {
  thumb:  [0.054, 0.042, 0.032],
  index:  [0.068, 0.050, 0.032],
  middle: [0.076, 0.056, 0.034],
  ring:   [0.070, 0.052, 0.032],
  pinky:  [0.050, 0.034, 0.022],
};

// Each finger: [proxRadius, midRadius, distRadius]
const F_RAD: Record<string, [number, number, number]> = {
  thumb:  [0.0145, 0.0126, 0.0108],
  index:  [0.0126, 0.0110, 0.0094],
  middle: [0.0132, 0.0116, 0.0098],
  ring:   [0.0122, 0.0107, 0.0092],
  pinky:  [0.0100, 0.0088, 0.0075],
};

// MCP position on palm (right-hand; flipped for left)
const MCP_POS: Record<string, THREE.Vector3> = {
  thumb:  new THREE.Vector3(-0.068,  0.022, 0.006),
  index:  new THREE.Vector3(-0.040,  0.077, 0.004),
  middle: new THREE.Vector3(-0.005,  0.085, 0.004),
  ring:   new THREE.Vector3( 0.030,  0.077, 0.004),
  pinky:  new THREE.Vector3( 0.060,  0.064, 0.004),
};

const REST_FLEX: Record<string, number> = {
  thumb: -0.08, index: 0.04, middle: 0.02, ring: -0.02, pinky: -0.05,
};

const REST_SPLAY: Record<string, number> = {
  thumb: -0.52, index: -0.10, middle: 0.00, ring: 0.09, pinky: 0.20,
};

// ─── Joint group structure ────────────────────────────────────────────────────
interface FingerRig {
  meta: THREE.Group; // attached to palm
  mcp:  THREE.Group; // splay + base flex
  pip:  THREE.Group; // middle joint
  dip:  THREE.Group; // tip joint
}

function buildFinger(name: string): FingerRig {
  const [pL, mL, dL] = F_LEN[name];
  const [pR, mR, dR] = F_RAD[name];

  // ── Proximal phalanx segment ──
  // Tip sphere radius = mR so the spheres at the joint share the same size → seamless blend
  const proxGrp = makeSegmentGeo(pR, mR, pL);

  // ── Middle phalanx segment ──
  // Base sphere at y=0 of pip overlaps tip sphere of prox (both radius mR)
  const midGrp = makeSegmentGeo(mR, dR, mL);

  // ── Distal phalanx segment ──
  const distGrp = makeSegmentGeo(dR, dR * 0.86, dL);

  // ── Nail ──
  const nailGeo = new THREE.SphereGeometry(dR * 0.92, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.46);
  nailGeo.applyMatrix4(new THREE.Matrix4().makeScale(0.82, 0.48, 1.04));
  nailGeo.translate(0, dL + dR * 1.2, -dR * 0.30);
  const nail = new THREE.Mesh(nailGeo, SHARED_NAIL);

  // ── DIP joint ──
  // Position: tip-sphere of mid segment (center at y = mL, radius mR) sits at same location as
  // base-sphere of dist segment (center at y = 0, radius dR ≈ mR-1) → nearly coincident → seamless
  const dip = new THREE.Group();
  dip.position.y = mL;     // place at top-sphere centre of middle segment
  dip.add(distGrp, nail);

  // ── PIP joint ──
  const pip = new THREE.Group();
  pip.position.y = pL;     // place at top-sphere centre of proximal segment
  pip.add(midGrp, dip);

  // ── MCP ──
  const mcp = new THREE.Group();
  mcp.add(proxGrp, pip);

  const meta = new THREE.Group();
  meta.add(mcp);

  return { meta, mcp, pip, dip };
}

// ─── Palm mesh ────────────────────────────────────────────────────────────────
// Single RoundedBoxGeometry – one mesh, one draw call, perfectly smooth edges.
function buildPalm(): THREE.Mesh {
  // width × height × depth, subdivisions, cornerRadius
  const geo = new RoundedBoxGeometry(0.158, 0.168, 0.058, 4, 0.020);
  return new THREE.Mesh(geo, SHARED_SKIN);
}

// ─── HandModel ────────────────────────────────────────────────────────────────
export class HandModel {
  public root: THREE.Group;
  private palmGroup: THREE.Group;
  private rigs: Record<string, FingerRig>;
  private isLeft: boolean;

  constructor(isLeft = false) {
    this.isLeft   = isLeft;
    this.root     = new THREE.Group();
    this.palmGroup = new THREE.Group();
    this.rigs     = {};

    // Palm slab (single unified mesh)
    const palm = buildPalm();
    palm.position.set(0.003, -0.002, 0);
    this.palmGroup.add(palm);

    // Wrist taper
    const wGeo = new THREE.CylinderGeometry(0.035, 0.040, 0.040, 14, 1);
    wGeo.translate(0, -0.030, 0);
    this.palmGroup.add(new THREE.Mesh(wGeo, SHARED_SKIN_DK));

    // Build fingers
    const names = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    names.forEach(name => {
      const rig = buildFinger(name);
      this.rigs[name] = rig;

      const pos = MCP_POS[name].clone();
      if (isLeft) pos.x = -pos.x;
      rig.meta.position.copy(pos);

      const splay = isLeft ? -REST_SPLAY[name] : REST_SPLAY[name];
      rig.mcp.rotation.x = REST_FLEX[name];
      rig.mcp.rotation.z = splay;

      this.palmGroup.add(rig.meta);
    });

    this.root.add(this.palmGroup);
    if (isLeft) this.root.scale.x = -1;
  }

  applyPose(pose: HandPose)               { this._setPose(pose, 1); }
  lerpToPose(pose: HandPose, t: number)   { this._setPose(pose, t); }

  private _setPose(pose: HandPose, t: number) {
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

  private _applyFinger(name: string, curl: number, spread: number, t: number) {
    const { mcp, pip, dip } = this.rigs[name];
    const maxFlex = Math.PI * 0.90;
    const sign    = this.isLeft ? 1 : -1;
    const baseZ   = this.isLeft ? -REST_SPLAY[name] : REST_SPLAY[name];

    const lr = (c: number, d: number) => c + (d - c) * t;
    mcp.rotation.x = lr(mcp.rotation.x, REST_FLEX[name] - curl * maxFlex * 0.36);
    mcp.rotation.z = lr(mcp.rotation.z, baseZ + sign * spread * 0.28);
    pip.rotation.x = lr(pip.rotation.x, -curl * maxFlex * 0.40);
    dip.rotation.x = lr(dip.rotation.x, -curl * maxFlex * 0.24);
  }

  private _applyThumb(flex: number, abd: number, t: number) {
    const { mcp, pip, dip } = this.rigs['thumb'];
    const maxFlex = Math.PI * 0.54;
    const maxAbd  = Math.PI * 0.46;
    const sign    = this.isLeft ? 1 : -1;
    const baseZ   = this.isLeft ? -REST_SPLAY['thumb'] : REST_SPLAY['thumb'];

    const lr = (c: number, d: number) => c + (d - c) * t;
    mcp.rotation.x = lr(mcp.rotation.x, REST_FLEX['thumb'] - flex * maxFlex * 0.35);
    mcp.rotation.z = lr(mcp.rotation.z, baseZ + sign * abd  * maxAbd);
    pip.rotation.x = lr(pip.rotation.x, -flex * maxFlex * 0.42);
    dip.rotation.x = lr(dip.rotation.x, -flex * maxFlex * 0.23);
  }

  dispose() {
    this.root.traverse(o => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}

// ─── FaceModel ────────────────────────────────────────────────────────────────
export class FaceModel {
  public root: THREE.Group;

  private leftBrow:  THREE.Group;
  private rightBrow: THREE.Group;
  private upperLip:  THREE.Mesh;
  private lowerLip:  THREE.Mesh;
  private leftLid:   THREE.Mesh;
  private rightLid:  THREE.Mesh;
  private leftCheek: THREE.Mesh;
  private rightCheek:THREE.Mesh;

  constructor() {
    this.root = new THREE.Group();

    const sk  = skinMat(SKIN,    0.68);
    const skd = skinMat(SKIN_DK, 0.74);
    const skl = skinMat(SKIN_LT, 0.62);
    const wm  = new THREE.MeshStandardMaterial({ color: EYE_W,  roughness: 0.12 });
    const im  = new THREE.MeshStandardMaterial({ color: IRIS,   roughness: 0.08 });
    const pm  = new THREE.MeshStandardMaterial({ color: PUPIL,  roughness: 0.40 });
    const bm  = new THREE.MeshStandardMaterial({ color: HAIR,   roughness: 0.72 });
    const hm  = new THREE.MeshStandardMaterial({ color: HAIR,   roughness: 0.78 });
    const lm  = new THREE.MeshStandardMaterial({ color: LIP,    roughness: 0.42 });
    const lsm = new THREE.MeshStandardMaterial({ color: 0x0e0808, roughness: 0.88 });

    // ── Head ──
    const headGeo = new THREE.SphereGeometry(0.190, 32, 24);
    headGeo.scale(1.0, 1.24, 0.95);
    this.root.add(new THREE.Mesh(headGeo, sk));

    // ── Jaw ──
    const jawGeo = new THREE.SphereGeometry(0.108, 20, 14);
    jawGeo.scale(1.0, 0.60, 0.88);
    const jaw = new THREE.Mesh(jawGeo, sk);
    jaw.position.set(0, -0.178, 0.036);
    this.root.add(jaw);

    // ── Ears ──
    [[-0.194, 1], [0.194, -1]].forEach(([ex]) => {
      const eg = new THREE.CapsuleGeometry(0.024, 0.050, 4, 10);
      const e  = new THREE.Mesh(eg, skd);
      e.position.set(ex as number, 0.010, 0.010);
      e.rotation.z = (ex as number) < 0 ? 0.22 : -0.22;
      this.root.add(e);
    });

    // ── Cheeks ──
    const ckGeo = new THREE.SphereGeometry(0.072, 12, 9);
    this.leftCheek  = new THREE.Mesh(ckGeo,       skl);
    this.rightCheek = new THREE.Mesh(ckGeo.clone(), skl);
    this.leftCheek.position.set( -0.118, -0.032, 0.128);
    this.rightCheek.position.set(  0.118, -0.032, 0.128);
    this.leftCheek.scale.setScalar(0.50);
    this.rightCheek.scale.setScalar(0.50);
    this.root.add(this.leftCheek, this.rightCheek);

    // ── Nose ──
    const nrg = new THREE.SphereGeometry(0.028, 12, 9);
    nrg.scale(0.72, 1.22, 1.0);
    const nr = new THREE.Mesh(nrg, sk);
    nr.position.set(0, -0.010, 0.185);
    this.root.add(nr);

    const ntg = new THREE.SphereGeometry(0.022, 12, 9);
    ntg.scale(1.14, 0.76, 1.04);
    const nt = new THREE.Mesh(ntg, sk);
    nt.position.set(0, -0.042, 0.196);
    this.root.add(nt);

    [-0.016, 0.016].forEach(nx => {
      const ng = new THREE.SphereGeometry(0.010, 10, 7);
      ng.scale(1, 0.64, 1);
      const n = new THREE.Mesh(ng, skd);
      n.position.set(nx, -0.050, 0.187);
      this.root.add(n);
    });

    // ── Eyes ──
    [[-0.066, true], [0.066, false]].forEach(([ex]) => {
      const eg = new THREE.Group();
      eg.position.set(ex as number, 0.032, 0.166);
      eg.add(new THREE.Mesh(new THREE.SphereGeometry(0.033, 16, 12), wm));
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.020, 14, 10), im);
      iris.position.z = 0.017;
      eg.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), pm);
      pupil.position.z = 0.026;
      eg.add(pupil);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hi.position.set(0.009, 0.009, 0.032);
      eg.add(hi);
      this.root.add(eg);
    });

    // ── Eyelids ──
    const makeLid = (ex: number): THREE.Mesh => {
      const lg = new THREE.SphereGeometry(0.036, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
      const l = new THREE.Mesh(lg, sk);
      l.position.set(ex, 0.032, 0.168);
      l.scale.y = 0.18;
      return l;
    };
    this.leftLid  = makeLid(-0.066);
    this.rightLid = makeLid( 0.066);
    this.root.add(this.leftLid, this.rightLid);

    // Lashes
    [-0.066, 0.066].forEach(ex => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.003, 0.002), lsm);
      l.position.set(ex, 0.050, 0.170);
      l.rotation.x = -0.10;
      this.root.add(l);
    });

    // ── Eyebrows ──
    const makeBrow = (ex: number): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(ex, 0.090, 0.157);
      const s1g = new THREE.CapsuleGeometry(0.005, 0.030, 3, 10);
      s1g.rotateZ(Math.PI / 2 + 0.18);
      const s2g = new THREE.CapsuleGeometry(0.004, 0.022, 3, 10);
      s2g.rotateZ(Math.PI / 2 - 0.22);
      g.add(new THREE.Mesh(s1g, bm) );
      const s2m = new THREE.Mesh(s2g, bm);
      s2m.position.x = ex < 0 ? 0.032 : -0.032;
      s2m.position.y = 0.004;
      g.add(s2m);
      return g;
    };
    this.leftBrow  = makeBrow(-0.066);
    this.rightBrow = makeBrow( 0.066);
    this.root.add(this.leftBrow, this.rightBrow);

    // ── Lips ──
    const ulg = new THREE.CapsuleGeometry(0.0105, 0.050, 4, 12);
    ulg.rotateZ(Math.PI / 2);
    ulg.scale(1, 0.66, 1.10);
    this.upperLip = new THREE.Mesh(ulg, lm);
    this.upperLip.position.set(0, -0.074, 0.173);
    this.root.add(this.upperLip);

    const llg = new THREE.CapsuleGeometry(0.0115, 0.052, 4, 12);
    llg.rotateZ(Math.PI / 2);
    llg.scale(1, 0.86, 1.10);
    this.lowerLip = new THREE.Mesh(llg, lm);
    this.lowerLip.position.set(0, -0.092, 0.172);
    this.root.add(this.lowerLip);

    [-0.030, 0.030].forEach(cx => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), lm);
      c.position.set(cx, -0.082, 0.171);
      this.root.add(c);
    });

    const phil = new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 6), skd);
    phil.geometry.scale(0.56, 1.22, 0.56);
    phil.position.set(0, -0.060, 0.181);
    this.root.add(phil);

    // ── Hair cap ──
    const hcg = new THREE.SphereGeometry(0.196, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56);
    hcg.scale(1.0, 1.24, 0.96);
    const hc = new THREE.Mesh(hcg, hm);
    hc.position.y = 0.018;
    this.root.add(hc);

    [-0.166, 0.166].forEach(sx => {
      const sg = new THREE.CapsuleGeometry(0.054, 0.080, 3, 12);
      const s = new THREE.Mesh(sg, hm);
      s.position.set(sx, 0.046, -0.018);
      s.rotation.z = sx < 0 ? 0.32 : -0.32;
      this.root.add(s);
    });

    // ── Neck ──
    const neck = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.058, 4, 14),
      skinMat(SKIN, 0.72)
    );
    neck.position.y = -0.240;
    this.root.add(neck);
  }

  applyExpression(e: FaceExpression)            { this._doExpr(e, 1); }
  lerpExpression(e: FaceExpression, t: number)  { this._doExpr(e, t); }

  private _doExpr(e: FaceExpression, t: number) {
    const lr = (c: number, d: number) => c + (d - c) * t;

    const browY = 0.090 + e.eyebrowRaise * 0.028;
    this.leftBrow.position.y  = lr(this.leftBrow.position.y,  browY);
    this.rightBrow.position.y = lr(this.rightBrow.position.y, browY);
    this.leftBrow.rotation.z  = lr(this.leftBrow.rotation.z,  -e.eyebrowRaise * 0.12);
    this.rightBrow.rotation.z = lr(this.rightBrow.rotation.z,   e.eyebrowRaise * 0.12);

    const sqt = Math.max(0, e.eyeSquint ?? 0);
    this.leftLid.scale.y  = lr(this.leftLid.scale.y,  0.18 + sqt * 0.72);
    this.rightLid.scale.y = lr(this.rightLid.scale.y, 0.18 + sqt * 0.72);

    const openOff = e.mouthOpen * 0.014;
    this.upperLip.position.y = lr(this.upperLip.position.y, -0.074 + openOff * 0.4);
    this.lowerLip.position.y = lr(this.lowerLip.position.y, -0.092 - openOff);
    const smX = 1 + e.mouthSmile * 0.40;
    this.upperLip.scale.x = lr(this.upperLip.scale.x, smX);
    this.lowerLip.scale.x = lr(this.lowerLip.scale.x, smX);

    const cks = 0.50 + (e.cheekPuff ?? 0) * 0.55;
    this.leftCheek.scale.setScalar(lr(this.leftCheek.scale.x, cks));
    this.rightCheek.scale.setScalar(lr(this.rightCheek.scale.x, cks));

    this.root.rotation.x = lr(this.root.rotation.x, e.headTiltX ?? 0);
    this.root.rotation.y = lr(this.root.rotation.y, e.headTiltY ?? 0);
  }

  dispose() {
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
