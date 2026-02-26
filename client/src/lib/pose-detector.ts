import {
  HandLandmarker,
  PoseLandmarker,
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { HandPose, FaceExpression } from "./asl-poses";

/** Body-relative hand position in normalized coordinates for spatial sign discrimination. */
export interface HandRelativePos {
  /** Lateral offset relative to shoulder midpoint (positive = signer's left). */
  posX: number;
  /** Vertical position mapped to signing regions (0 = hip level, 0.68 = forehead). */
  posY: number;
  /** Depth relative to shoulders (positive = closer to camera). */
  posZ: number;
}

/**
 * Complete per-frame detection output combining hand poses, body landmarks,
 * spatial hand positions, and facial expression data.
 */
export interface DetectionResult {
  left: HandPose | null;
  right: HandPose | null;
  landmarks: NormalizedLandmark[][] | null;
  rightHandPos: HandRelativePos | null;
  leftHandPos: HandRelativePos | null;
  detectedFace: FaceExpression | null;
  bodyLandmarks: NormalizedLandmark[] | null;
}

const LANDMARK = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

const POSE_LANDMARK = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  RIGHT_EYE_INNER: 4,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

type Vec3 = { x: number; y: number; z: number };

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function vlength(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vec3): Vec3 {
  const len = vlength(v);
  if (len < 1e-8) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function angleBetween(a: Vec3, b: Vec3): number {
  const na = normalize(a);
  const nb = normalize(b);
  const d = Math.max(-1, Math.min(1, dot(na, nb)));
  return Math.acos(d);
}

/**
 * Computes finger curl as the sum of inter-joint angles normalized to [0, 1].
 * 0 = fully extended, 1 = maximally curled.
 *
 * @param lm - 21-point hand landmarks from MediaPipe
 * @param mcp - Metacarpophalangeal joint index
 * @param pip - Proximal interphalangeal joint index
 * @param dip - Distal interphalangeal joint index
 * @param tip - Fingertip landmark index
 * @returns Curl value in [0, 1]
 */
function computeFingerCurl(
  lm: NormalizedLandmark[],
  mcp: number,
  pip: number,
  dip: number,
  tip: number,
): number {
  const mcpToPip = sub(lm[pip], lm[mcp]);
  const pipToDip = sub(lm[dip], lm[pip]);
  const dipToTip = sub(lm[tip], lm[dip]);

  const angle1 = angleBetween(mcpToPip, pipToDip);
  const angle2 = angleBetween(pipToDip, dipToTip);

  const totalAngle = angle1 + angle2;
  const maxAngle = Math.PI;
  return Math.min(1, Math.max(0, totalAngle / maxAngle));
}

/**
 * Computes spread between two adjacent fingers as the angle between
 * wrist-to-MCP vectors, normalized relative to a rest angle.
 *
 * @param lm - 21-point hand landmarks
 * @param thisMcp - MCP landmark index of the finger being measured
 * @param adjacentMcp - MCP landmark index of the adjacent reference finger
 * @param wrist - Wrist landmark index
 * @param isOutward - If true, negate the result (for index finger spreading outward)
 * @returns Spread value in [-1, 1]
 */
function computeFingerSpread(
  lm: NormalizedLandmark[],
  thisMcp: number,
  adjacentMcp: number,
  wrist: number,
  isOutward: boolean,
): number {
  const wristToThis = sub(lm[thisMcp], lm[wrist]);
  const wristToAdj = sub(lm[adjacentMcp], lm[wrist]);

  const angle = angleBetween(wristToThis, wristToAdj);
  const restAngle = 0.15;
  const maxSpread = 0.5;

  const spread = (angle - restAngle) / (maxSpread - restAngle);
  const clamped = Math.min(1, Math.max(-1, spread));
  return isOutward ? -clamped : clamped;
}

function computeThumbFlex(lm: NormalizedLandmark[]): number {
  const cmcToMcp = sub(lm[LANDMARK.THUMB_MCP], lm[LANDMARK.THUMB_CMC]);
  const mcpToIp = sub(lm[LANDMARK.THUMB_IP], lm[LANDMARK.THUMB_MCP]);
  const ipToTip = sub(lm[LANDMARK.THUMB_TIP], lm[LANDMARK.THUMB_IP]);

  const angle1 = angleBetween(cmcToMcp, mcpToIp);
  const angle2 = angleBetween(mcpToIp, ipToTip);

  const totalAngle = angle1 + angle2;
  return Math.min(1, Math.max(0, totalAngle / Math.PI));
}

function computeThumbAbduction(lm: NormalizedLandmark[]): number {
  const wristToThumbCmc = sub(lm[LANDMARK.THUMB_CMC], lm[LANDMARK.WRIST]);
  const wristToIndexMcp = sub(lm[LANDMARK.INDEX_MCP], lm[LANDMARK.WRIST]);

  const angle = angleBetween(wristToThumbCmc, wristToIndexMcp);
  const minAngle = 0.1;
  const maxAngle = 1.2;

  return Math.min(1, Math.max(0, (angle - minAngle) / (maxAngle - minAngle)));
}

/**
 * Estimates wrist rotation from palm orientation vectors.
 * Computes palm direction, lateral direction, and palm normal from
 * wrist/index/pinky/middle MCP landmarks.
 *
 * @returns wristX (flexion/extension), wristY (pronation/supination), wristZ (radial/ulnar deviation)
 */
function computeWristRotation(lm: NormalizedLandmark[]): {
  wristX: number;
  wristY: number;
  wristZ: number;
} {
  const wrist = lm[LANDMARK.WRIST];
  const indexMcp = lm[LANDMARK.INDEX_MCP];
  const pinkyMcp = lm[LANDMARK.PINKY_MCP];
  const middleMcp = lm[LANDMARK.MIDDLE_MCP];

  const palmDir = normalize(sub(middleMcp, wrist));
  const lateralDir = normalize(sub(indexMcp, pinkyMcp));
  const palmNormal = normalize(cross(palmDir, lateralDir));

  const wristX = Math.max(-1, Math.min(1, -palmDir.y * 1.5));
  const wristY = Math.max(-1, Math.min(1, palmNormal.z * 1.5));
  const wristZ = Math.max(-1, Math.min(1, lateralDir.y * 1.5));

  return { wristX, wristY, wristZ };
}

/**
 * Converts raw 21-point MediaPipe hand landmarks into a structured HandPose
 * with curl/spread for each finger, thumb flex/abd, and wrist rotation.
 */
function landmarksToHandPose(lm: NormalizedLandmark[]): HandPose {
  const indexCurl = computeFingerCurl(lm, LANDMARK.INDEX_MCP, LANDMARK.INDEX_PIP, LANDMARK.INDEX_DIP, LANDMARK.INDEX_TIP);
  const middleCurl = computeFingerCurl(lm, LANDMARK.MIDDLE_MCP, LANDMARK.MIDDLE_PIP, LANDMARK.MIDDLE_DIP, LANDMARK.MIDDLE_TIP);
  const ringCurl = computeFingerCurl(lm, LANDMARK.RING_MCP, LANDMARK.RING_PIP, LANDMARK.RING_DIP, LANDMARK.RING_TIP);
  const pinkyCurl = computeFingerCurl(lm, LANDMARK.PINKY_MCP, LANDMARK.PINKY_PIP, LANDMARK.PINKY_DIP, LANDMARK.PINKY_TIP);

  const indexSpread = computeFingerSpread(lm, LANDMARK.INDEX_MCP, LANDMARK.MIDDLE_MCP, LANDMARK.WRIST, true);
  const middleSpread = computeFingerSpread(lm, LANDMARK.MIDDLE_MCP, LANDMARK.RING_MCP, LANDMARK.WRIST, false);
  const ringSpread = computeFingerSpread(lm, LANDMARK.RING_MCP, LANDMARK.PINKY_MCP, LANDMARK.WRIST, false);
  const pinkySpread = computeFingerSpread(lm, LANDMARK.PINKY_MCP, LANDMARK.RING_MCP, LANDMARK.WRIST, false);

  const thumbFlex = computeThumbFlex(lm);
  const thumbAbd = computeThumbAbduction(lm);
  const { wristX, wristY, wristZ } = computeWristRotation(lm);

  return {
    thumb: { flex: thumbFlex, abd: thumbAbd },
    index: { curl: indexCurl, spread: indexSpread },
    middle: { curl: middleCurl, spread: middleSpread },
    ring: { curl: ringCurl, spread: ringSpread },
    pinky: { curl: pinkyCurl, spread: pinkySpread },
    wristX,
    wristY,
    wristZ,
  };
}

/**
 * Computes hand position relative to the signer's body using pose landmarks.
 *
 * Vertical mapping uses anatomical reference points (forehead → eyes → nose →
 * mouth → chin → shoulders → hips) to produce a continuous posY value that
 * maps to discrete signing regions. This body-relative normalization makes
 * detection robust to camera distance and signer height.
 *
 * @param handWrist - Hand wrist landmark from HandLandmarker
 * @param bodyLandmarks - 33-point body pose landmarks from PoseLandmarker
 * @returns Body-relative position with posX, posY, posZ
 */
function computeHandRelativePos(
  handWrist: NormalizedLandmark,
  bodyLandmarks: NormalizedLandmark[],
): HandRelativePos {
  const lShoulder = bodyLandmarks[POSE_LANDMARK.LEFT_SHOULDER];
  const rShoulder = bodyLandmarks[POSE_LANDMARK.RIGHT_SHOULDER];
  const nose = bodyLandmarks[POSE_LANDMARK.NOSE];
  const lHip = bodyLandmarks[POSE_LANDMARK.LEFT_HIP];
  const rHip = bodyLandmarks[POSE_LANDMARK.RIGHT_HIP];
  const mouthL = bodyLandmarks[POSE_LANDMARK.MOUTH_LEFT];
  const mouthR = bodyLandmarks[POSE_LANDMARK.MOUTH_RIGHT];
  const eyeL = bodyLandmarks[POSE_LANDMARK.LEFT_EYE_INNER];
  const eyeR = bodyLandmarks[POSE_LANDMARK.RIGHT_EYE_INNER];

  const shoulderMidX = (lShoulder.x + rShoulder.x) / 2;
  const shoulderMidY = (lShoulder.y + rShoulder.y) / 2;
  const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
  const scale = shoulderWidth > 0.01 ? shoulderWidth : 0.2;

  const hipMidY = (lHip.y + rHip.y) / 2;
  const handY = handWrist.y;

  const rawEyeY = (eyeL.y + eyeR.y) / 2;
  const rawNoseY = nose.y;
  const rawMouthY = (mouthL.y + mouthR.y) / 2;

  const noseY = rawNoseY;
  const eyeY = rawEyeY < noseY ? rawEyeY : noseY - 0.02;
  const mouthY = rawMouthY > noseY ? rawMouthY : noseY + 0.02;
  const foreheadY = eyeY - Math.max(0.01, (noseY - eyeY) * 0.3);
  const chinY = mouthY + Math.max(0.01, (mouthY - noseY) * 0.7);

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  let posY: number;
  if (handY <= foreheadY) {
    posY = 0.68;
  } else if (handY <= eyeY) {
    const t = clamp01((eyeY - handY) / Math.max(0.01, eyeY - foreheadY));
    posY = 0.62 + t * (0.68 - 0.62);
  } else if (handY <= noseY) {
    const t = clamp01((noseY - handY) / Math.max(0.01, noseY - eyeY));
    posY = 0.54 + t * (0.62 - 0.54);
  } else if (handY <= mouthY) {
    const t = clamp01((mouthY - handY) / Math.max(0.01, mouthY - noseY));
    posY = 0.51 + t * (0.54 - 0.51);
  } else if (handY <= chinY) {
    const t = clamp01((chinY - handY) / Math.max(0.01, chinY - mouthY));
    posY = 0.40 + t * (0.51 - 0.40);
  } else if (handY <= shoulderMidY) {
    const t = clamp01((shoulderMidY - handY) / Math.max(0.01, shoulderMidY - chinY));
    posY = 0.12 + t * (0.40 - 0.12);
  } else if (handY <= hipMidY) {
    const t = clamp01((hipMidY - handY) / Math.max(0.01, hipMidY - shoulderMidY));
    posY = -0.08 + t * (0.12 - (-0.08));
  } else {
    posY = -0.08;
  }

  const lateralOffset = (shoulderMidX - handWrist.x) / scale;
  const posX = lateralOffset * 0.15;

  const lsZ = (lShoulder as any).z ?? 0;
  const rsZ = (rShoulder as any).z ?? 0;
  const shoulderMidZ = (lsZ + rsZ) / 2;
  const handZ = (handWrist as any).z ?? 0;
  const depthDiff = shoulderMidZ - handZ;
  const posZ = Math.max(-0.1, Math.min(0.2, depthDiff * 0.3));

  return { posX, posY, posZ };
}

/**
 * Extracts a simplified FaceExpression from ARKit-compatible blendshape scores.
 * Aggregates individual blendshapes (e.g., browInnerUp, browOuterUpLeft/Right)
 * into composite values (eyebrowRaise) with thresholds to reduce noise.
 *
 * @param blendShapes - Array of blendshape categories from FaceLandmarker
 * @returns Simplified facial expression with 5 semantic parameters
 */
function extractFaceExpression(
  blendShapes: Array<{ categoryName: string; score: number }>,
): FaceExpression {
  const get = (name: string): number => {
    const entry = blendShapes.find((b) => b.categoryName === name);
    return entry ? entry.score : 0;
  };

  const browInnerUp = get("browInnerUp");
  const browOuterUpL = get("browOuterUpLeft");
  const browOuterUpR = get("browOuterUpRight");
  const browDownL = get("browDownLeft");
  const browDownR = get("browDownRight");
  const browUp = (browInnerUp + browOuterUpL + browOuterUpR) / 3;
  const browDown = (browDownL + browDownR) / 2;
  const eyebrowRaise = browUp > 0.15 ? browUp : browDown > 0.15 ? -browDown : 0;

  const jawOpen = get("jawOpen");
  const mouthOpen = Math.min(1, jawOpen * 1.5);

  const smileL = get("mouthSmileLeft");
  const smileR = get("mouthSmileRight");
  const frownL = get("mouthFrownLeft");
  const frownR = get("mouthFrownRight");
  const smile = (smileL + smileR) / 2;
  const frown = (frownL + frownR) / 2;
  const mouthSmile = smile > 0.15 ? smile : frown > 0.15 ? -frown : 0;

  const cheekPuffL = get("cheekPuff");
  const cheekPuff = cheekPuffL;

  const squintL = get("eyeSquintLeft");
  const squintR = get("eyeSquintRight");
  const eyeSquint = (squintL + squintR) / 2;

  return {
    eyebrowRaise,
    mouthOpen,
    mouthSmile,
    cheekPuff,
    eyeSquint,
  };
}

const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

/**
 * Orchestrates MediaPipe hand, pose, and face landmark detection.
 *
 * Initializes three ML models (HandLandmarker, PoseLandmarker, FaceLandmarker)
 * running on GPU, and provides a single `detect()` method that returns
 * unified hand poses, body-relative positions, and facial expressions per frame.
 */
export class PoseDetector {
  private handLandmarker: HandLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private lastTimestamp = -1;

  /**
   * Initializes all three MediaPipe models in parallel.
   * Downloads WASM runtime and model assets from CDN on first call.
   */
  async init(_video?: HTMLVideoElement): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);

    const [hand, pose, face] = await Promise.all([
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      }),
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      }),
    ]);

    this.handLandmarker = hand;
    this.poseLandmarker = pose;
    this.faceLandmarker = face;
  }

  /**
   * Runs all three detectors on the current video frame and combines results.
   * Hand landmarks are converted to HandPose, body pose is used to compute
   * body-relative hand positions, and face blendshapes are simplified.
   *
   * Note: MediaPipe handedness labels are mirrored (camera perspective),
   * so "Left" handedness maps to the signer's right hand.
   *
   * @param video - HTMLVideoElement with active camera stream
   * @returns Combined detection result for the frame
   */
  detect(video: HTMLVideoElement): DetectionResult {
    const empty: DetectionResult = {
      left: null,
      right: null,
      landmarks: null,
      rightHandPos: null,
      leftHandPos: null,
      detectedFace: null,
      bodyLandmarks: null,
    };

    if (!this.handLandmarker) return empty;

    let timestamp = performance.now();
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    const handResult = this.handLandmarker.detectForVideo(video, timestamp);

    let poseResult: any = null;
    if (this.poseLandmarker) {
      try {
        poseResult = this.poseLandmarker.detectForVideo(video, timestamp + 0.1);
      } catch (_) {}
    }

    let faceResult: any = null;
    if (this.faceLandmarker) {
      try {
        faceResult = this.faceLandmarker.detectForVideo(video, timestamp + 0.2);
      } catch (_) {}
    }

    let leftPose: HandPose | null = null;
    let rightPose: HandPose | null = null;
    let leftWristLm: NormalizedLandmark | null = null;
    let rightWristLm: NormalizedLandmark | null = null;

    if (
      handResult.landmarks &&
      handResult.landmarks.length > 0 &&
      handResult.handednesses &&
      handResult.handednesses.length > 0
    ) {
      for (let i = 0; i < handResult.landmarks.length; i++) {
        const lm = handResult.landmarks[i];
        const handedness = handResult.handednesses[i]?.[0]?.categoryName;
        const pose = landmarksToHandPose(lm);

        if (handedness === "Left") {
          rightPose = pose;
          rightWristLm = lm[LANDMARK.WRIST];
        } else if (handedness === "Right") {
          leftPose = pose;
          leftWristLm = lm[LANDMARK.WRIST];
        }
      }
    }

    const bodyLandmarks: NormalizedLandmark[] | null =
      poseResult?.landmarks?.[0] ?? null;

    let rightHandPos: HandRelativePos | null = null;
    let leftHandPos: HandRelativePos | null = null;

    if (bodyLandmarks && bodyLandmarks.length >= 25) {
      if (rightWristLm) {
        rightHandPos = computeHandRelativePos(rightWristLm, bodyLandmarks);
      }
      if (leftWristLm) {
        leftHandPos = computeHandRelativePos(leftWristLm, bodyLandmarks);
      }
    }

    let detectedFace: FaceExpression | null = null;
    if (
      faceResult?.faceBlendshapes &&
      faceResult.faceBlendshapes.length > 0 &&
      faceResult.faceBlendshapes[0]?.categories
    ) {
      detectedFace = extractFaceExpression(faceResult.faceBlendshapes[0].categories);
    }

    return {
      left: leftPose,
      right: rightPose,
      landmarks: handResult.landmarks?.length > 0 ? handResult.landmarks : null,
      rightHandPos,
      leftHandPos,
      detectedFace,
      bodyLandmarks,
    };
  }

  /** Closes all MediaPipe model instances and releases GPU resources. */
  destroy(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = null;
    }
  }
}
