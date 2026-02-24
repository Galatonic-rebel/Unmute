import {
  HandLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { HandPose } from "./asl-poses";

export interface DetectionResult {
  left: HandPose | null;
  right: HandPose | null;
  landmarks: NormalizedLandmark[][] | null;
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

function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vec3): Vec3 {
  const len = length(v);
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
  const indexCurl = computeFingerCurl(
    lm,
    LANDMARK.INDEX_MCP,
    LANDMARK.INDEX_PIP,
    LANDMARK.INDEX_DIP,
    LANDMARK.INDEX_TIP,
  );
  const middleCurl = computeFingerCurl(
    lm,
    LANDMARK.MIDDLE_MCP,
    LANDMARK.MIDDLE_PIP,
    LANDMARK.MIDDLE_DIP,
    LANDMARK.MIDDLE_TIP,
  );
  const ringCurl = computeFingerCurl(
    lm,
    LANDMARK.RING_MCP,
    LANDMARK.RING_PIP,
    LANDMARK.RING_DIP,
    LANDMARK.RING_TIP,
  );
  const pinkyCurl = computeFingerCurl(
    lm,
    LANDMARK.PINKY_MCP,
    LANDMARK.PINKY_PIP,
    LANDMARK.PINKY_DIP,
    LANDMARK.PINKY_TIP,
  );

  const indexSpread = computeFingerSpread(
    lm,
    LANDMARK.INDEX_MCP,
    LANDMARK.MIDDLE_MCP,
    LANDMARK.WRIST,
    true,
  );
  const middleSpread = computeFingerSpread(
    lm,
    LANDMARK.MIDDLE_MCP,
    LANDMARK.RING_MCP,
    LANDMARK.WRIST,
    false,
  );
  const ringSpread = computeFingerSpread(
    lm,
    LANDMARK.RING_MCP,
    LANDMARK.PINKY_MCP,
    LANDMARK.WRIST,
    false,
  );
  const pinkySpread = computeFingerSpread(
    lm,
    LANDMARK.PINKY_MCP,
    LANDMARK.RING_MCP,
    LANDMARK.WRIST,
    false,
  );

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

export class PoseDetector {
  private handLandmarker: HandLandmarker | null = null;
  private lastTimestamp = -1;

  async init(_video?: HTMLVideoElement): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
  }

  detect(video: HTMLVideoElement): DetectionResult {
    if (!this.handLandmarker) {
      return { left: null, right: null, landmarks: null };
    }

    let timestamp = performance.now();
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    const result = this.handLandmarker.detectForVideo(video, timestamp);

    if (
      !result.landmarks ||
      result.landmarks.length === 0 ||
      !result.handednesses ||
      result.handednesses.length === 0
    ) {
      return { left: null, right: null, landmarks: null };
    }

    let leftPose: HandPose | null = null;
    let rightPose: HandPose | null = null;

    for (let i = 0; i < result.landmarks.length; i++) {
      const lm = result.landmarks[i];
      const handedness = result.handednesses[i]?.[0]?.categoryName;
      const pose = landmarksToHandPose(lm);

      if (handedness === "Left") {
        rightPose = pose;
      } else if (handedness === "Right") {
        leftPose = pose;
      }
    }

    return {
      left: leftPose,
      right: rightPose,
      landmarks: result.landmarks,
    };
  }

  destroy(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
  }
}
