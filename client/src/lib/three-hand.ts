import * as THREE from 'three';
import type { HandPose, FingerState, ThumbState } from './asl-poses';

// Finger segment lengths (realistic proportions, in world units)
const PALM_W = 0.18;
const PALM_H = 0.22;
const PALM_D = 0.05;

interface FingerSegments {
  mcp: THREE.Group;    // metacarpal-phalangeal group (rotates whole finger)
  proximal: THREE.Mesh;
  pip: THREE.Group;    // proximal-inter-phalangeal (rotates middle + distal)
  middle: THREE.Mesh;
  dip: THREE.Group;    // distal-inter-phalangeal (rotates distal)
  distal: THREE.Mesh;
  mcpSphere: THREE.Mesh;
  pipSphere: THREE.Mesh;
  dipSphere: THREE.Mesh;
}

// Finger bone lengths [proximal, middle, distal]
const FINGER_LENGTHS: Record<string, [number, number, number]> = {
  thumb:  [0.055, 0.045, 0.035],
  index:  [0.085, 0.055, 0.04],
  middle: [0.095, 0.06,  0.042],
  ring:   [0.088, 0.055, 0.038],
  pinky:  [0.068, 0.042, 0.032],
};

const FINGER_RADIUS: Record<string, number> = {
  thumb:  0.016,
  index:  0.014,
  middle: 0.014,
  ring:   0.013,
  pinky:  0.012,
};

// MCP offsets relative to palm center (x = lateral, y = vertical, z = depth)
const MCP_OFFSETS: Record<string, [number, number, number]> = {
  thumb:  [-0.09, 0.04, 0.01],
  index:  [-0.055, 0.1, 0],
  middle: [-0.01, 0.108, 0],
  ring:   [0.04, 0.1, 0],
  pinky:  [0.083, 0.086, 0],
};

// Resting angle of each finger relative to palm (in radians, x-axis flex)
const REST_ANGLES: Record<string, number> = {
  thumb:  -0.1,
  index:  0.05,
  middle: 0,
  ring:   -0.03,
  pinky:  -0.06,
};

// Lateral spread angles (z-axis) at rest
const SPREAD_ANGLES: Record<string, number> = {
  thumb:  -0.55,
  index:  -0.12,
  middle: 0,
  ring:   0.1,
  pinky:  0.2,
};

const SKIN_COLOR = new THREE.Color(0xf4c291);
const SKIN_DARK = new THREE.Color(0xe8ab76);
const NAIL_COLOR = new THREE.Color(0xffcba4);

function createMaterial(color: THREE.Color): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.0,
  });
}

function createBone(length: number, radius: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius * 0.85, radius, length, 12, 1);
  geo.translate(0, length / 2, 0);
  return new THREE.Mesh(geo, mat);
}

function createJointSphere(radius: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 10, 8);
  return new THREE.Mesh(geo, mat);
}

function buildFinger(name: string, isLeft: boolean): FingerSegments {
  const [pLen, mLen, dLen] = FINGER_LENGTHS[name];
  const r = FINGER_RADIUS[name];
  const mat = createMaterial(SKIN_COLOR);
  const jointMat = createMaterial(SKIN_DARK);

  const mcpSphere = createJointSphere(r * 1.1, jointMat);
  const pipSphere = createJointSphere(r * 1.0, jointMat);
  const dipSphere = createJointSphere(r * 0.9, jointMat);

  const proximal = createBone(pLen, r, mat);
  const middle = createBone(mLen, r * 0.9, mat);
  const distal = createBone(dLen, r * 0.8, mat);

  // DIP group: holds distal bone, rotates at DIP joint
  const dip = new THREE.Group();
  dip.position.set(0, mLen, 0);
  dip.add(dipSphere);
  dip.add(distal);

  // PIP group: holds middle bone + dip group, rotates at PIP joint
  const pip = new THREE.Group();
  pip.position.set(0, pLen, 0);
  pip.add(pipSphere);
  pip.add(middle);
  pip.add(dip);

  // MCP group: holds proximal bone + pip group, rotates at MCP joint
  const mcp = new THREE.Group();
  mcp.add(mcpSphere);
  mcp.add(proximal);
  mcp.add(pip);

  return { mcp, proximal, pip, middle, dip, distal, mcpSphere, pipSphere, dipSphere };
}

export class HandModel {
  public root: THREE.Group;
  private palm: THREE.Mesh;
  private fingers: Record<string, FingerSegments>;
  private wristGroup: THREE.Group;
  private isLeft: boolean;

  constructor(isLeft = false) {
    this.isLeft = isLeft;
    this.root = new THREE.Group();
    this.wristGroup = new THREE.Group();
    this.root.add(this.wristGroup);

    // Palm
    const palmGeo = new THREE.BoxGeometry(PALM_W, PALM_H, PALM_D, 2, 3, 1);
    this.palm = new THREE.Mesh(palmGeo, createMaterial(SKIN_COLOR));
    this.wristGroup.add(this.palm);

    // Fingers
    this.fingers = {};
    const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    fingerNames.forEach((name) => {
      const segs = buildFinger(name, isLeft);
      this.fingers[name] = segs;

      const [ox, oy, oz] = MCP_OFFSETS[name];
      segs.mcp.position.set(isLeft ? -ox : ox, oy, oz);
      segs.mcp.rotation.x = REST_ANGLES[name];
      segs.mcp.rotation.z = isLeft ? -SPREAD_ANGLES[name] : SPREAD_ANGLES[name];
      this.wristGroup.add(segs.mcp);
    });

    if (isLeft) {
      this.root.scale.x = -1;
    }
  }

  /** Apply a HandPose, smoothly lerping from current state */
  applyPose(pose: HandPose): void {
    this.applyThumb(pose.thumb);
    this.applyFinger('index', pose.index);
    this.applyFinger('middle', pose.middle);
    this.applyFinger('ring', pose.ring);
    this.applyFinger('pinky', pose.pinky);

    // Wrist rotation
    this.wristGroup.rotation.x = pose.wristX ?? 0;
    this.wristGroup.rotation.y = pose.wristY ?? 0;
    this.wristGroup.rotation.z = pose.wristZ ?? 0;
  }

  /** Lerp toward a target pose (t=0 stays, t=1 snaps) */
  lerpToPose(pose: HandPose, t: number): void {
    this.lerpThumb(pose.thumb, t);
    this.lerpFinger('index', pose.index, t);
    this.lerpFinger('middle', pose.middle, t);
    this.lerpFinger('ring', pose.ring, t);
    this.lerpFinger('pinky', pose.pinky, t);

    const wx = pose.wristX ?? 0;
    const wy = pose.wristY ?? 0;
    const wz = pose.wristZ ?? 0;
    this.wristGroup.rotation.x += (wx - this.wristGroup.rotation.x) * t;
    this.wristGroup.rotation.y += (wy - this.wristGroup.rotation.y) * t;
    this.wristGroup.rotation.z += (wz - this.wristGroup.rotation.z) * t;
  }

  private applyThumb(state: ThumbState): void {
    const segs = this.fingers['thumb'];
    const maxFlex = Math.PI * 0.5;
    const maxAbd = Math.PI * 0.45;

    segs.mcp.rotation.x = REST_ANGLES['thumb'] - state.flex * maxFlex * 0.4;
    const sign = this.isLeft ? 1 : -1;
    segs.mcp.rotation.z = (this.isLeft ? -SPREAD_ANGLES['thumb'] : SPREAD_ANGLES['thumb'])
      + sign * state.abd * maxAbd;

    segs.pip.rotation.x = -state.flex * maxFlex * 0.55;
    segs.dip.rotation.x = -state.flex * maxFlex * 0.35;
  }

  private lerpThumb(state: ThumbState, t: number): void {
    const segs = this.fingers['thumb'];
    const maxFlex = Math.PI * 0.5;
    const maxAbd = Math.PI * 0.45;

    const targetMCPX = REST_ANGLES['thumb'] - state.flex * maxFlex * 0.4;
    const sign = this.isLeft ? 1 : -1;
    const baseMCPZ = this.isLeft ? -SPREAD_ANGLES['thumb'] : SPREAD_ANGLES['thumb'];
    const targetMCPZ = baseMCPZ + sign * state.abd * maxAbd;
    const targetPIPX = -state.flex * maxFlex * 0.55;
    const targetDIPX = -state.flex * maxFlex * 0.35;

    segs.mcp.rotation.x += (targetMCPX - segs.mcp.rotation.x) * t;
    segs.mcp.rotation.z += (targetMCPZ - segs.mcp.rotation.z) * t;
    segs.pip.rotation.x += (targetPIPX - segs.pip.rotation.x) * t;
    segs.dip.rotation.x += (targetDIPX - segs.dip.rotation.x) * t;
  }

  private applyFinger(name: string, state: FingerState): void {
    const segs = this.fingers[name];
    const maxFlex = Math.PI * 0.85;
    const maxSpread = 0.25;

    segs.mcp.rotation.x = REST_ANGLES[name] - state.curl * maxFlex * 0.45;
    const sign = this.isLeft ? 1 : -1;
    const baseZ = this.isLeft ? -SPREAD_ANGLES[name] : SPREAD_ANGLES[name];
    segs.mcp.rotation.z = baseZ + sign * state.spread * maxSpread;

    segs.pip.rotation.x = -state.curl * maxFlex * 0.55;
    segs.dip.rotation.x = -state.curl * maxFlex * 0.35;
  }

  private lerpFinger(name: string, state: FingerState, t: number): void {
    const segs = this.fingers[name];
    const maxFlex = Math.PI * 0.85;
    const maxSpread = 0.25;

    const targetMCPX = REST_ANGLES[name] - state.curl * maxFlex * 0.45;
    const sign = this.isLeft ? 1 : -1;
    const baseZ = this.isLeft ? -SPREAD_ANGLES[name] : SPREAD_ANGLES[name];
    const targetMCPZ = baseZ + sign * state.spread * maxSpread;
    const targetPIPX = -state.curl * maxFlex * 0.55;
    const targetDIPX = -state.curl * maxFlex * 0.35;

    segs.mcp.rotation.x += (targetMCPX - segs.mcp.rotation.x) * t;
    segs.mcp.rotation.z += (targetMCPZ - segs.mcp.rotation.z) * t;
    segs.pip.rotation.x += (targetPIPX - segs.pip.rotation.x) * t;
    segs.dip.rotation.x += (targetDIPX - segs.dip.rotation.x) * t;
  }

  dispose(): void {
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          (obj.material as THREE.Material).dispose();
        }
      }
    });
  }
}

// ==========================
// Face Model
// ==========================
export class FaceModel {
  public root: THREE.Group;
  private head: THREE.Mesh;
  private leftEye: THREE.Mesh;
  private rightEye: THREE.Mesh;
  private leftEyeLid: THREE.Mesh;
  private rightEyeLid: THREE.Mesh;
  private leftBrow: THREE.Mesh;
  private rightBrow: THREE.Mesh;
  private mouth: THREE.Mesh;
  private leftCheek: THREE.Mesh;
  private rightCheek: THREE.Mesh;
  private nose: THREE.Mesh;

  constructor() {
    this.root = new THREE.Group();

    const skinMat = createMaterial(SKIN_COLOR);
    const darkMat = createMaterial(SKIN_DARK);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const darkEyeMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.5 });
    const browMat = new THREE.MeshStandardMaterial({ color: 0x4a2c0a, roughness: 0.6 });
    const lipMat = new THREE.MeshStandardMaterial({ color: 0xc06060, roughness: 0.5 });

    // Head
    const headGeo = new THREE.SphereGeometry(0.18, 24, 20);
    headGeo.scale(1, 1.2, 0.95);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.root.add(this.head);

    // Eyes (white + iris+pupil)
    const eyeWhiteGeo = new THREE.SphereGeometry(0.033, 12, 10);
    const irisGeo = new THREE.SphereGeometry(0.021, 10, 8);
    const pupilGeo = new THREE.SphereGeometry(0.013, 8, 6);

    const buildEye = (x: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0.025, 0.16);
      const white = new THREE.Mesh(eyeWhiteGeo, whiteMat);
      const iris = new THREE.Mesh(irisGeo, new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.3 }));
      iris.position.z = 0.015;
      const pupil = new THREE.Mesh(pupilGeo, darkEyeMat);
      pupil.position.z = 0.022;
      g.add(white, iris, pupil);
      this.root.add(g);
      return white;
    };

    this.leftEye = buildEye(-0.065);
    this.rightEye = buildEye(0.065);

    // Eyelids (for blinking / squinting)
    const lidGeo = new THREE.SphereGeometry(0.034, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5);
    this.leftEyeLid = new THREE.Mesh(lidGeo, skinMat);
    this.leftEyeLid.position.set(-0.065, 0.025, 0.166);
    this.leftEyeLid.rotation.x = -Math.PI * 0.05;
    this.leftEyeLid.scale.y = 0.15;
    this.root.add(this.leftEyeLid);

    this.rightEyeLid = new THREE.Mesh(lidGeo.clone(), skinMat);
    this.rightEyeLid.position.set(0.065, 0.025, 0.166);
    this.rightEyeLid.rotation.x = -Math.PI * 0.05;
    this.rightEyeLid.scale.y = 0.15;
    this.root.add(this.rightEyeLid);

    // Eyebrows
    const browGeo = new THREE.CapsuleGeometry(0.006, 0.05, 4, 8);
    browGeo.rotateZ(Math.PI * 0.5);
    this.leftBrow = new THREE.Mesh(browGeo, browMat);
    this.leftBrow.position.set(-0.065, 0.075, 0.155);
    this.root.add(this.leftBrow);

    this.rightBrow = new THREE.Mesh(browGeo.clone(), browMat);
    this.rightBrow.position.set(0.065, 0.075, 0.155);
    this.root.add(this.rightBrow);

    // Nose
    const noseGeo = new THREE.SphereGeometry(0.025, 8, 6);
    noseGeo.scale(1, 0.7, 1.1);
    this.nose = new THREE.Mesh(noseGeo, skinMat);
    this.nose.position.set(0, -0.02, 0.175);
    this.root.add(this.nose);

    // Mouth (capsule shape)
    const mouthGeo = new THREE.CapsuleGeometry(0.01, 0.06, 4, 8);
    mouthGeo.rotateZ(Math.PI * 0.5);
    this.mouth = new THREE.Mesh(mouthGeo, lipMat);
    this.mouth.position.set(0, -0.07, 0.165);
    this.root.add(this.mouth);

    // Cheeks (for puffing)
    const cheekGeo = new THREE.SphereGeometry(0.06, 8, 6);
    this.leftCheek = new THREE.Mesh(cheekGeo, skinMat);
    this.leftCheek.position.set(-0.11, -0.02, 0.13);
    this.leftCheek.scale.set(0.5, 0.5, 0.5);
    this.root.add(this.leftCheek);

    this.rightCheek = new THREE.Mesh(cheekGeo.clone(), skinMat);
    this.rightCheek.position.set(0.11, -0.02, 0.13);
    this.rightCheek.scale.set(0.5, 0.5, 0.5);
    this.root.add(this.rightCheek);
  }

  applyExpression(expr: { eyebrowRaise: number; mouthOpen: number; mouthSmile: number; headTiltX?: number; headTiltY?: number; cheekPuff?: number; eyeSquint?: number }): void {
    // Eyebrows
    const browY = 0.075 + expr.eyebrowRaise * 0.03;
    this.leftBrow.position.y = browY;
    this.rightBrow.position.y = browY;
    this.leftBrow.rotation.z = -expr.eyebrowRaise * 0.1;
    this.rightBrow.rotation.z = expr.eyebrowRaise * 0.1;

    // Mouth open/smile
    this.mouth.position.y = -0.07 - expr.mouthOpen * 0.018;
    this.mouth.scale.y = 1 + expr.mouthOpen * 1.5;
    this.mouth.scale.x = 1 + expr.mouthSmile * 0.4;
    this.mouth.rotation.z = 0;

    // Squint (eyelids)
    const squint = expr.eyeSquint ?? 0;
    this.leftEyeLid.scale.y = 0.15 + squint * 0.7;
    this.rightEyeLid.scale.y = 0.15 + squint * 0.7;

    // Cheek puff
    const puff = expr.cheekPuff ?? 0;
    const cheekScale = 0.5 + puff * 0.5;
    this.leftCheek.scale.set(cheekScale, cheekScale, cheekScale);
    this.rightCheek.scale.set(cheekScale, cheekScale, cheekScale);

    // Head tilt
    this.root.rotation.x = expr.headTiltX ?? 0;
    this.root.rotation.y = expr.headTiltY ?? 0;
  }

  lerpExpression(expr: { eyebrowRaise: number; mouthOpen: number; mouthSmile: number; headTiltX?: number; headTiltY?: number; cheekPuff?: number; eyeSquint?: number }, t: number): void {
    const browY = 0.075 + expr.eyebrowRaise * 0.03;
    this.leftBrow.position.y += (browY - this.leftBrow.position.y) * t;
    this.rightBrow.position.y += (browY - this.rightBrow.position.y) * t;

    const targetBrowZ = expr.eyebrowRaise * 0.1;
    this.leftBrow.rotation.z += (-targetBrowZ - this.leftBrow.rotation.z) * t;
    this.rightBrow.rotation.z += (targetBrowZ - this.rightBrow.rotation.z) * t;

    const targetMouthY = -0.07 - expr.mouthOpen * 0.018;
    this.mouth.position.y += (targetMouthY - this.mouth.position.y) * t;
    const targetMouthSY = 1 + expr.mouthOpen * 1.5;
    this.mouth.scale.y += (targetMouthSY - this.mouth.scale.y) * t;
    const targetMouthSX = 1 + expr.mouthSmile * 0.4;
    this.mouth.scale.x += (targetMouthSX - this.mouth.scale.x) * t;

    const squint = expr.eyeSquint ?? 0;
    const targetLidY = 0.15 + squint * 0.7;
    this.leftEyeLid.scale.y += (targetLidY - this.leftEyeLid.scale.y) * t;
    this.rightEyeLid.scale.y += (targetLidY - this.rightEyeLid.scale.y) * t;

    const puff = expr.cheekPuff ?? 0;
    const cheekScale = 0.5 + puff * 0.5;
    this.leftCheek.scale.x += (cheekScale - this.leftCheek.scale.x) * t;
    this.leftCheek.scale.y += (cheekScale - this.leftCheek.scale.y) * t;
    this.leftCheek.scale.z += (cheekScale - this.leftCheek.scale.z) * t;
    this.rightCheek.scale.x += (cheekScale - this.rightCheek.scale.x) * t;
    this.rightCheek.scale.y += (cheekScale - this.rightCheek.scale.y) * t;
    this.rightCheek.scale.z += (cheekScale - this.rightCheek.scale.z) * t;

    const htx = expr.headTiltX ?? 0;
    const hty = expr.headTiltY ?? 0;
    this.root.rotation.x += (htx - this.root.rotation.x) * t;
    this.root.rotation.y += (hty - this.root.rotation.y) * t;
  }

  dispose(): void {
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          (obj.material as THREE.Material).dispose();
        }
      }
    });
  }
}
