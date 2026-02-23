import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { HandPose, FaceExpression } from './asl-poses';

const FINGER_MAP: Record<string, string> = {
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
};

const CURL_MAX = Math.PI * 0.90;
const CURL_WEIGHTS = [0.36, 0.40, 0.24];
const THUMB_FLEX_MAX = Math.PI * 0.54;
const THUMB_ABD_MAX = Math.PI * 0.46;
const THUMB_FLEX_WEIGHTS = [0.35, 0.42, 0.23];

const ARM_READY = {
  armPitch: 1.05,
  armYaw: 0.25,
  elbowBend: 1.45,
};

const POS_SENSITIVITY = {
  y: 2.5,
  x: 2.0,
  z: 1.5,
};

interface ArmChain {
  arm: THREE.Bone;
  forearm: THREE.Bone;
  hand: THREE.Bone;
}

export class AvatarController {
  public root: THREE.Group;
  private bones = new Map<string, THREE.Bone>();
  private morphMesh: THREE.SkinnedMesh | null = null;
  private morphDict = new Map<string, number>();
  private restQuats = new Map<string, THREE.Quaternion>();

  private headBone: THREE.Bone | null = null;
  private headRestQ = new THREE.Quaternion();

  private readyQuats = new Map<string, THREE.Quaternion>();

  private armChains: Record<'left' | 'right', ArmChain | null> = { left: null, right: null };

  private spineBones: THREE.Bone[] = [];
  private spineRestQuats: THREE.Quaternion[] = [];

  private _loaded = false;

  constructor() {
    this.root = new THREE.Group();
  }

  get isLoaded() { return this._loaded; }

  async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    this.root.add(model);

    model.traverse((obj) => {
      if (obj instanceof THREE.Bone) {
        this.bones.set(obj.name, obj);
        this.restQuats.set(obj.name, obj.quaternion.clone());
      }
      if (obj instanceof THREE.SkinnedMesh) {
        if (obj.morphTargetDictionary && Object.keys(obj.morphTargetDictionary).length > 0) {
          this.morphMesh = obj;
          for (const [name, idx] of Object.entries(obj.morphTargetDictionary)) {
            this.morphDict.set(name, idx);
          }
        }
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material.envMapIntensity = 0.8;
        }
      }
    });

    this.headBone = this.bones.get('Head') ?? null;
    if (this.headBone) this.headRestQ.copy(this.headBone.quaternion);

    for (const side of ['Left', 'Right'] as const) {
      const arm = this.bones.get(`${side}Arm`);
      const forearm = this.bones.get(`${side}ForeArm`);
      const hand = this.bones.get(`${side}Hand`);
      if (arm && forearm && hand) {
        this.armChains[side.toLowerCase() as 'left' | 'right'] = { arm, forearm, hand };
      }
    }

    for (const name of ['Spine', 'Spine1', 'Spine2']) {
      const bone = this.bones.get(name);
      if (bone) {
        this.spineBones.push(bone);
        this.spineRestQuats.push(bone.quaternion.clone());
      }
    }

    this.setupReadyPose();
    this._loaded = true;
  }

  private setupReadyPose() {
    for (const side of ['left', 'right'] as const) {
      const chain = this.armChains[side];
      if (!chain) continue;

      const prefix = side === 'left' ? 'Left' : 'Right';
      const sign = side === 'left' ? 1 : -1;

      const armRestQ = this.restQuats.get(`${prefix}Arm`)!.clone();
      const pitchQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ARM_READY.armPitch);
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ARM_READY.armYaw * sign);
      const armQ = armRestQ.clone().multiply(pitchQ).multiply(yawQ);
      chain.arm.quaternion.copy(armQ);
      this.readyQuats.set(`${side}Arm`, armQ.clone());

      const forearmRestQ = this.restQuats.get(`${prefix}ForeArm`)!.clone();
      const bendQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ARM_READY.elbowBend);
      const forearmQ = forearmRestQ.clone().multiply(bendQ);
      chain.forearm.quaternion.copy(forearmQ);
      this.readyQuats.set(`${side}Forearm`, forearmQ.clone());
    }
  }

  applyHandPose(side: 'left' | 'right', pose: HandPose, t: number) {
    if (!this._loaded) return;
    const prefix = side === 'left' ? 'Left' : 'Right';

    for (const [poseFinger, boneFinger] of Object.entries(FINGER_MAP)) {
      const fp = (pose as any)[poseFinger] as { curl: number; spread: number };
      this._applyFingerBones(prefix, boneFinger, fp.curl, fp.spread, t);
    }

    this._applyThumbBones(prefix, pose.thumb.flex, pose.thumb.abd, t);

    const handBone = this.bones.get(`${prefix}Hand`);
    if (handBone) {
      const baseQ = this.restQuats.get(`${prefix}Hand`)!.clone();
      const wristQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(pose.wristX ?? 0, pose.wristY ?? 0, pose.wristZ ?? 0)
      );
      const targetQ = baseQ.multiply(wristQ);
      handBone.quaternion.slerp(targetQ, t);
    }
  }

  private _applyFingerBones(prefix: string, finger: string, curl: number, spread: number, t: number) {
    for (let i = 1; i <= 3; i++) {
      const boneName = `${prefix}Hand${finger}${i}`;
      const bone = this.bones.get(boneName);
      if (!bone) continue;

      const restQ = this.restQuats.get(boneName)!.clone();
      const curlAngle = curl * CURL_MAX * CURL_WEIGHTS[i - 1];
      const spreadAngle = i === 1 ? spread * 0.28 : 0;

      const addQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(curlAngle, 0, spreadAngle));
      const targetQ = restQ.multiply(addQ);
      bone.quaternion.slerp(targetQ, t);
    }
  }

  private _applyThumbBones(prefix: string, flex: number, abd: number, t: number) {
    for (let i = 1; i <= 3; i++) {
      const boneName = `${prefix}HandThumb${i}`;
      const bone = this.bones.get(boneName);
      if (!bone) continue;

      const restQ = this.restQuats.get(boneName)!.clone();
      const flexAngle = flex * THUMB_FLEX_MAX * THUMB_FLEX_WEIGHTS[i - 1];
      const abdAngle = i === 1 ? abd * THUMB_ABD_MAX : 0;

      const addQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(flexAngle, 0, abdAngle));
      const targetQ = restQ.multiply(addQ);
      bone.quaternion.slerp(targetQ, t);
    }
  }

  setHandTarget(side: 'left' | 'right', offsetX: number, offsetY: number, offsetZ: number, t: number) {
    if (!this._loaded) return;
    const chain = this.armChains[side];
    if (!chain) return;

    const sign = side === 'left' ? 1 : -1;

    const armReadyQ = this.readyQuats.get(`${side}Arm`)!.clone();
    const pitchDelta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -offsetY * POS_SENSITIVITY.y);
    const yawDelta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), offsetX * POS_SENSITIVITY.x * sign);
    const armTargetQ = armReadyQ.multiply(pitchDelta).multiply(yawDelta);
    chain.arm.quaternion.slerp(armTargetQ, t);

    const forearmReadyQ = this.readyQuats.get(`${side}Forearm`)!.clone();
    const elbowDelta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -offsetZ * POS_SENSITIVITY.z);
    const forearmTargetQ = forearmReadyQ.multiply(elbowDelta);
    chain.forearm.quaternion.slerp(forearmTargetQ, t);
  }

  resetArms(t: number) {
    for (const side of ['left', 'right'] as const) {
      const chain = this.armChains[side];
      if (!chain) continue;

      const armQ = this.readyQuats.get(`${side}Arm`);
      if (armQ) chain.arm.quaternion.slerp(armQ, t);

      const forearmQ = this.readyQuats.get(`${side}Forearm`);
      if (forearmQ) chain.forearm.quaternion.slerp(forearmQ, t);
    }
  }

  applyExpression(expr: FaceExpression, t: number) {
    if (!this.morphMesh || !this.morphMesh.morphTargetInfluences) return;
    const infl = this.morphMesh.morphTargetInfluences;

    const targets = new Map<string, number>();

    if (expr.eyebrowRaise >= 0) {
      targets.set('browInnerUp', expr.eyebrowRaise);
      targets.set('browOuterUpLeft', expr.eyebrowRaise * 0.7);
      targets.set('browOuterUpRight', expr.eyebrowRaise * 0.7);
      targets.set('browDownLeft', 0);
      targets.set('browDownRight', 0);
    } else {
      targets.set('browDownLeft', -expr.eyebrowRaise);
      targets.set('browDownRight', -expr.eyebrowRaise);
      targets.set('browInnerUp', 0);
      targets.set('browOuterUpLeft', 0);
      targets.set('browOuterUpRight', 0);
    }

    targets.set('jawOpen', expr.mouthOpen);

    if (expr.mouthSmile >= 0) {
      targets.set('mouthSmileLeft', expr.mouthSmile);
      targets.set('mouthSmileRight', expr.mouthSmile);
      targets.set('mouthFrownLeft', 0);
      targets.set('mouthFrownRight', 0);
    } else {
      targets.set('mouthFrownLeft', -expr.mouthSmile);
      targets.set('mouthFrownRight', -expr.mouthSmile);
      targets.set('mouthSmileLeft', 0);
      targets.set('mouthSmileRight', 0);
    }

    targets.set('cheekPuff', expr.cheekPuff ?? 0);

    const sq = expr.eyeSquint ?? 0;
    targets.set('eyeBlinkLeft', sq);
    targets.set('eyeBlinkRight', sq);

    for (const [name, target] of targets) {
      const idx = this.morphDict.get(name);
      if (idx === undefined) continue;
      infl[idx] = infl[idx] + (target - infl[idx]) * t;
    }

    for (const [name, idx] of this.morphDict) {
      if (!targets.has(name)) {
        infl[idx] = infl[idx] * (1 - t * 0.5);
      }
    }

    if (this.headBone) {
      const tiltQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(expr.headTiltX ?? 0, expr.headTiltY ?? 0, 0)
      );
      const targetQ = this.headRestQ.clone().multiply(tiltQ);
      this.headBone.quaternion.slerp(targetQ, t);
    }
  }

  applySway(time: number) {
    if (!this._loaded) return;
    const ts = time * 0.0006;
    const swayAngle = Math.sin(ts) * 0.006;
    const breathAngle = Math.sin(ts * 0.72) * 0.004;

    for (let i = 0; i < this.spineBones.length; i++) {
      const bone = this.spineBones[i];
      const restQ = this.spineRestQuats[i].clone();
      const swayQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(breathAngle / (i + 1), swayAngle / (i + 1), 0)
      );
      bone.quaternion.copy(restQ.multiply(swayQ));
    }
  }

  dispose() {
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: THREE.Material) => m.dispose());
      }
    });
  }
}
