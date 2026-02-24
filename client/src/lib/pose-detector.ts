import {
  HandLandmarker,
  PoseLandmarker,
  FaceLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { HandPose, FaceExpression } from "./asl-poses";

export interface HandRelativePos {
  posX: number;
  posY: number;
  posZ: number;
}

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

function computeHandRelativePos(
  handWrist: NormalizedLandmark,
  bodyLandmarks: NormalizedLandmark[],
): HandRelativePos {
  const lShoulder = bodyLandmarks[POSE_LANDMARK.LEFT_SHOULDER];
  const rShoulder = bodyLandmarks[POSE_LANDMARK.RIGHT_SHOULDER];
  const nose = bodyLandmarks[POSE_LANDMARK.NOSE];
  const lHip = bodyLandmarks[POSE_LANDMARK.LEFT_HIP];
  const rHip = bodyLandmarks[POSE_LANDMARK.RIGHT_HIP];

  const shoulderMidX = (lShoulder.x + rShoulder.x) / 2;
  const shoulderMidY = (lShoulder.y + rShoulder.y) / 2;
  const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x);
  const scale = shoulderWidth > 0.01 ? shoulderWidth : 0.2;

  const hipMidY = (lHip.y + rHip.y) / 2;
  const noseY = nose.y;
  const bodyHeight = hipMidY - noseY;

  const handY = handWrist.y;
  const relativeHeight = (shoulderMidY - handY) / (bodyHeight > 0.05 ? bodyHeight : 0.3);

  const AT_REST = -0.08;
  const FACE_TOP = 0.72;
  const posY = AT_REST + relativeHeight * (FACE_TOP - AT_REST);

  const lateralOffset = (shoulderMidX - handWrist.x) / scale;
  const posX = lateralOffset * 0.15;

  const shoulderMidZ = ((lShoulder as any).z ?? 0 + (rShoulder as any).z ?? 0) / 2;
  const handZ = (handWrist as any).z ?? 0;
  const depthDiff = shoulderMidZ - handZ;
  const posZ = depthDiff * 0.3;

  return { posX, posY, posZ };
}

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

export class PoseDetector {
  private handLandmarker: HandLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private lastTimestamp = -1;

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
