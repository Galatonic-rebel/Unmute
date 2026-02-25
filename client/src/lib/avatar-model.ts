import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { HandPose, FaceExpression } from './asl-poses';

const FINGER_MAP: Record<string, string> = {
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
};

const CURL_MAX = Math.PI * 0.90;
const CURL_WEIGHTS = [0.36, 0.40, 0.24];
const THUMB_FLEX_MAX = Math.PI * 0.32;
const THUMB_ABD_MAX = Math.PI * 0.22;
const THUMB_FLEX_WEIGHTS = [0.38, 0.40, 0.22];

interface ArmChain {
  shoulder: THREE.Bone;
  arm: THREE.Bone;
  forearm: THREE.Bone;
  hand: THREE.Bone;
  upperLen: number;
  lowerLen: number;
}

const SIGN_REST_MODEL_Y = 1.15;
const SIGN_BASE_Z = 0.22;
const SIGN_SIDE_X = 0.17;

export class AvatarController {
  public root: THREE.Group;
  private bones = new Map<string, THREE.Bone>();
  private morphMeshes: THREE.SkinnedMesh[] = [];
  private morphDicts: Map<string, number>[] = [];
  private restQuats = new Map<string, THREE.Quaternion>();

  private headBone: THREE.Bone | null = null;
  private headRestQ = new THREE.Quaternion();

  private armChains: Record<'left' | 'right', ArmChain | null> = { left: null, right: null };

  private spineBones: THREE.Bone[] = [];
  private spineRestQuats: THREE.Quaternion[] = [];

  private idleArmQuats: Record<'left' | 'right', { arm: THREE.Quaternion; forearm: THREE.Quaternion }> = {
    left: { arm: new THREE.Quaternion(), forearm: new THREE.Quaternion() },
    right: { arm: new THREE.Quaternion(), forearm: new THREE.Quaternion() },
  };

  private _loaded = false;

  private mixer: THREE.AnimationMixer | null = null;
  private clipCache = new Map<string, THREE.AnimationClip>();
  private currentAction: THREE.AnimationAction | null = null;
  private _animationPlaying = false;

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
          const dict = new Map<string, number>();
          for (const [name, idx] of Object.entries(obj.morphTargetDictionary)) {
            dict.set(name, idx);
          }
          this.morphMeshes.push(obj);
          this.morphDicts.push(dict);
        }
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mat = obj.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.envMapIntensity = 1.8;
          mat.needsUpdate = true;
        }
      }
    });

    this.headBone = this.bones.get('Head') ?? null;
    if (this.headBone) this.headRestQ.copy(this.headBone.quaternion);

    model.updateWorldMatrix(true, true);
    for (const side of ['Left', 'Right'] as const) {
      const shoulder = this.bones.get(`${side}Shoulder`);
      const arm = this.bones.get(`${side}Arm`);
      const forearm = this.bones.get(`${side}ForeArm`);
      const hand = this.bones.get(`${side}Hand`);
      if (shoulder && arm && forearm && hand) {
        const armPos = new THREE.Vector3();
        const forearmPos = new THREE.Vector3();
        const handPos = new THREE.Vector3();
        arm.getWorldPosition(armPos);
        forearm.getWorldPosition(forearmPos);
        hand.getWorldPosition(handPos);

        arm.scale.setScalar(0.92);
        forearm.scale.setScalar(0.93);

        arm.updateWorldMatrix(true, true);
        arm.getWorldPosition(armPos);
        forearm.getWorldPosition(forearmPos);
        hand.getWorldPosition(handPos);

        const key = side.toLowerCase() as 'left' | 'right';
        this.armChains[key] = {
          shoulder, arm, forearm, hand,
          upperLen: armPos.distanceTo(forearmPos),
          lowerLen: forearmPos.distanceTo(handPos),
        };
      }
    }

    for (const name of ['Spine', 'Spine1', 'Spine2']) {
      const bone = this.bones.get(name);
      if (bone) {
        this.spineBones.push(bone);
        this.spineRestQuats.push(bone.quaternion.clone());
      }
    }

    this.mixer = new THREE.AnimationMixer(model);

    this._spreadShoulders();
    this._computeIdlePose();
    this._applyIdlePose(1);

    this._loaded = true;
  }

  private _spreadShoulders() {
    for (const side of ['left', 'right'] as const) {
      const chain = this.armChains[side];
      if (!chain) continue;
      const sign = side === 'left' ? 1 : -1;

      const shoulderRestQ = this.restQuats.get(chain.shoulder.name);
      if (!shoulderRestQ) continue;

      const spread = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, 0, sign * -0.32)
      );
      const newQ = shoulderRestQ.clone().multiply(spread);
      chain.shoulder.quaternion.copy(newQ);

      this.restQuats.set(chain.shoulder.name, newQ.clone());
    }
  }

  private _computeIdlePose() {
    for (const side of ['left', 'right'] as const) {
      const chain = this.armChains[side];
      if (!chain) continue;

      chain.arm.quaternion.copy(this.restQuats.get(chain.arm.name)!);
      chain.forearm.quaternion.copy(this.restQuats.get(chain.forearm.name)!);
      chain.arm.updateWorldMatrix(true, true);

      const armRestQ = this.restQuats.get(chain.arm.name)!;
      const forearmRestQ = this.restQuats.get(chain.forearm.name)!;

      const sign = side === 'left' ? 1 : -1;
      const armDown = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.22, 0, sign * 0.05)
      );
      const forearmBend = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.08, 0, 0)
      );

      this.idleArmQuats[side].arm = armRestQ.clone().multiply(armDown);
      this.idleArmQuats[side].forearm = forearmRestQ.clone().multiply(forearmBend);
    }
  }

  private _applyIdlePose(t: number) {
    for (const side of ['left', 'right'] as const) {
      const chain = this.armChains[side];
      if (!chain) continue;
      chain.arm.quaternion.slerp(this.idleArmQuats[side].arm, t);
      chain.forearm.quaternion.slerp(this.idleArmQuats[side].forearm, t);
    }
  }

  private _solveArmIK(side: 'left' | 'right', targetModelPos: THREE.Vector3, t: number) {
    const chain = this.armChains[side];
    if (!chain) return;

    const savedArmQ = chain.arm.quaternion.clone();
    const savedForearmQ = chain.forearm.quaternion.clone();

    chain.arm.quaternion.copy(this.restQuats.get(chain.arm.name)!);
    chain.forearm.quaternion.copy(this.restQuats.get(chain.forearm.name)!);
    chain.arm.updateWorldMatrix(true, true);

    const shoulderPos = new THREE.Vector3();
    const elbowRestPos = new THREE.Vector3();
    chain.arm.getWorldPosition(shoulderPos);
    chain.forearm.getWorldPosition(elbowRestPos);

    const L1 = chain.upperLen;
    const L2 = chain.lowerLen;

    const targetWorld = targetModelPos.clone().applyMatrix4(this.root.matrixWorld);

    const toTarget = targetWorld.clone().sub(shoulderPos);
    let dist = toTarget.length();
    dist = THREE.MathUtils.clamp(dist, Math.abs(L1 - L2) + 0.005, (L1 + L2) - 0.005);
    const targetDir = toTarget.clone().normalize();

    const cosA = THREE.MathUtils.clamp(
      (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1
    );
    const angleA = Math.acos(cosA);

    const poleOffset = side === 'left' ? 0.32 : -0.32;
    const poleWorld = new THREE.Vector3(
      shoulderPos.x + poleOffset,
      shoulderPos.y - 0.30,
      shoulderPos.z - 0.20
    );

    const toPole = poleWorld.clone().sub(shoulderPos);
    const planeNormal = new THREE.Vector3().crossVectors(targetDir, toPole);
    if (planeNormal.lengthSq() < 0.0001) planeNormal.set(0, 0, 1);
    planeNormal.normalize();
    const planeUp = new THREE.Vector3().crossVectors(planeNormal, targetDir).normalize();

    const desiredArmDir = new THREE.Vector3()
      .addScaledVector(targetDir, Math.cos(angleA))
      .addScaledVector(planeUp, Math.sin(angleA))
      .normalize();

    const restArmDir = elbowRestPos.clone().sub(shoulderPos).normalize();

    const armRotDelta = new THREE.Quaternion().setFromUnitVectors(restArmDir, desiredArmDir);

    const armRestWorldQ = new THREE.Quaternion();
    chain.arm.getWorldQuaternion(armRestWorldQ);

    const armDesiredWorldQ = armRotDelta.clone().multiply(armRestWorldQ);

    const armParentWorldQ = new THREE.Quaternion();
    if (chain.arm.parent) chain.arm.parent.getWorldQuaternion(armParentWorldQ);
    const armDesiredLocalQ = armParentWorldQ.clone().invert().multiply(armDesiredWorldQ);

    chain.arm.quaternion.copy(armDesiredLocalQ);
    chain.arm.updateWorldMatrix(false, true);

    const newElbowPos = new THREE.Vector3();
    const newHandPos = new THREE.Vector3();
    chain.forearm.getWorldPosition(newElbowPos);
    chain.hand.getWorldPosition(newHandPos);

    const currentForearmDir = newHandPos.clone().sub(newElbowPos).normalize();
    const desiredForearmDir = targetWorld.clone().sub(newElbowPos).normalize();

    const forearmRotDelta = new THREE.Quaternion().setFromUnitVectors(currentForearmDir, desiredForearmDir);

    const forearmCurrentWorldQ = new THREE.Quaternion();
    chain.forearm.getWorldQuaternion(forearmCurrentWorldQ);

    const forearmDesiredWorldQ = forearmRotDelta.clone().multiply(forearmCurrentWorldQ);

    const forearmParentWorldQ = new THREE.Quaternion();
    if (chain.forearm.parent) chain.forearm.parent.getWorldQuaternion(forearmParentWorldQ);
    const forearmDesiredLocalQ = forearmParentWorldQ.clone().invert().multiply(forearmDesiredWorldQ);

    chain.arm.quaternion.copy(savedArmQ).slerp(armDesiredLocalQ, t);
    chain.forearm.quaternion.copy(savedForearmQ).slerp(forearmDesiredLocalQ, t);
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

  setHandTarget(side: 'left' | 'right', posX: number, posY: number, posZ: number, t: number) {
    if (!this._loaded) return;

    const sign = side === 'left' ? 1 : -1;
    const target = new THREE.Vector3(
      sign * SIGN_SIDE_X + posX,
      SIGN_REST_MODEL_Y + posY,
      SIGN_BASE_Z + posZ
    );

    this._solveArmIK(side, target, t);
  }

  resetArms(t: number) {
    if (!this._loaded) return;
    this._applyIdlePose(t);
  }

  applyExpression(expr: FaceExpression, t: number) {
    if (this.morphMeshes.length === 0) return;

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

    for (let mi = 0; mi < this.morphMeshes.length; mi++) {
      const infl = this.morphMeshes[mi].morphTargetInfluences;
      if (!infl) continue;
      const dict = this.morphDicts[mi];

      for (const [name, target] of targets) {
        const idx = dict.get(name);
        if (idx === undefined) continue;
        infl[idx] = infl[idx] + (target - infl[idx]) * t;
      }

      for (const [name, idx] of dict) {
        if (!targets.has(name)) {
          infl[idx] = infl[idx] * (1 - t * 0.5);
        }
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

    const swayY = Math.sin(ts * 0.85) * 0.012 + Math.sin(ts * 1.9) * 0.005;
    const swayZ = Math.sin(ts * 0.65) * 0.006;
    const breathX = Math.sin(ts * 0.72) * 0.010;

    for (let i = 0; i < this.spineBones.length; i++) {
      const bone = this.spineBones[i];
      const restQ = this.spineRestQuats[i].clone();
      const d = i + 1;
      const swayQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(breathX / d, swayY / d, swayZ / d)
      );
      bone.quaternion.copy(restQ.multiply(swayQ));
    }

    if (this.headBone && !this._animationPlaying) {
      const headNod = Math.sin(ts * 0.8) * 0.007
                    + Math.sin(ts * 1.4) * 0.004
                    + Math.sin(ts * 2.7) * 0.002;
      const headTilt = Math.sin(ts * 0.42) * 0.005
                     + Math.sin(ts * 1.15) * 0.003;
      const headTurn = Math.sin(ts * 0.35) * 0.004
                     + Math.sin(ts * 0.95) * 0.002;
      const headQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(headNod, headTurn, headTilt)
      );
      this.headBone.quaternion.multiply(headQ);
    }

    for (const side of ['left', 'right'] as const) {
      const chain = this.armChains[side];
      if (!chain || this._animationPlaying) continue;
      const s = side === 'left' ? 1 : -1;
      const phase = s * 1.5;
      const armDrift = breathX * 0.35 + Math.sin(ts * 0.45 + phase) * 0.005;
      const forearmDrift = breathX * 0.2 + Math.sin(ts * 0.6 + phase + 1.0) * 0.004;
      const armQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(armDrift, 0, 0)
      );
      const forearmQ = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(forearmDrift, 0, 0)
      );
      chain.arm.quaternion.multiply(armQ);
      chain.forearm.quaternion.multiply(forearmQ);
    }
  }

  private _restoreBlend = 0;
  private _restoring = false;

  private _restoreAfterAnimation() {
    this._restoring = true;
    this._restoreBlend = 0;
  }

  updateRestore(dt: number) {
    if (!this._restoring) return;
    this._restoreBlend = Math.min(this._restoreBlend + dt / 300, 1);
    const t = this._restoreBlend * this._restoreBlend * (3 - 2 * this._restoreBlend);
    this.restQuats.forEach((restQ, name) => {
      if (!this._isSigningBone(name)) return;
      const bone = this.bones.get(name);
      if (bone) bone.quaternion.slerp(restQ, t);
    });
    if (this._restoreBlend >= 1) this._restoring = false;
  }

  private static readonly SIGN_BONES = new Set([
    'Neck', 'Head',
    'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightArm', 'RightForeArm', 'RightHand',
  ]);

  private _isSigningBone(boneName: string): boolean {
    if (AvatarController.SIGN_BONES.has(boneName)) return true;
    if (boneName.startsWith('LeftHand') || boneName.startsWith('RightHand')) return true;
    return false;
  }

  private _loadClip(url: string): Promise<THREE.AnimationClip | null> {
    const cached = this.clipCache.get(url);
    if (cached) return Promise.resolve(cached);

    const fbxLoader = new FBXLoader();
    return fbxLoader.loadAsync(url).then(fbxGroup => {
      if (!fbxGroup.animations.length) {
        console.warn('No animations found in', url);
        return null;
      }
      const clip = fbxGroup.animations[0];
      clip.tracks = clip.tracks
        .map(track => {
          track.name = track.name.replace(/^mixamorig:?/, '');
          return track;
        })
        .filter(track => {
          if (!track.name.endsWith('.quaternion')) return false;
          const boneName = track.name.replace('.quaternion', '');
          return this._isSigningBone(boneName);
        });
      this.clipCache.set(url, clip);
      return clip;
    });
  }

  private static readonly CROSSFADE_DUR = 0.6;

  async loadAndPlayAnimation(url: string): Promise<void> {
    if (!this.mixer) return;

    const clip = await this._loadClip(url);
    if (!clip) return;

    const prevAction = this.currentAction;

    if (prevAction) {
      prevAction.fadeOut(AvatarController.CROSSFADE_DUR);
      const prevClip = prevAction.getClip();
      setTimeout(() => {
        prevAction.stop();
        this.mixer?.uncacheAction(prevClip);
      }, AvatarController.CROSSFADE_DUR * 1000 + 50);
    }

    this.mixer.uncacheAction(clip);
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    action.reset();
    action.fadeIn(prevAction ? AvatarController.CROSSFADE_DUR : 0.35);
    action.play();

    this.currentAction = action;
    this._animationPlaying = true;

    const clipDuration = clip.duration * 1000;
    const safetyTimeout = Math.max(clipDuration + 1000, 3000);

    return new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        this.mixer?.removeEventListener('finished', onFinished);
        this._animationPlaying = false;
        resolve();
      };

      const onFinished = (e: { action: THREE.AnimationAction }) => {
        if (e.action === action) {
          done();
        }
      };
      this.mixer!.addEventListener('finished', onFinished);

      setTimeout(done, safetyTimeout);
    });
  }

  updateMixer(deltaSeconds: number) {
    this.mixer?.update(deltaSeconds);
  }

  restoreToIdle() {
    this._restoreAfterAnimation();
    this._applyIdlePose(1);
  }

  stopAnimation() {
    if (this.currentAction) {
      this.currentAction.stop();
      if (this.mixer) {
        this.mixer.uncacheAction(this.currentAction.getClip());
      }
      this.currentAction = null;
    }
    this._animationPlaying = false;
    this._restoreAfterAnimation();
  }

  isAnimationPlaying(): boolean {
    return this._animationPlaying;
  }

  dispose() {
    this.stopAnimation();
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: THREE.Material) => m.dispose());
      }
    });
  }
}
