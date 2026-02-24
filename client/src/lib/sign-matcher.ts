import type { HandPose, FaceExpression } from "./asl-poses";
import { FINGERSPELLING, WORD_SIGNS } from "./asl-poses";
import type { HandRelativePos } from "./pose-detector";

export interface MatchResult {
  word: string;
  confidence: number;
}

export interface FullMatchInput {
  right: HandPose | null;
  left: HandPose | null;
  rightHandPos: HandRelativePos | null;
  leftHandPos: HandRelativePos | null;
  detectedFace: FaceExpression | null;
}

const WEIGHTS = {
  curl: 1.0,
  spread: 0.4,
  thumbFlex: 0.9,
  thumbAbd: 0.7,
  wrist: 0.3,
  posY: 2.0,
  posX: 0.8,
  posZ: 0.4,
  face: 0.5,
};

const CONFIDENCE_THRESHOLD = 0.45;
const STABILITY_FRAMES = 8;
const COOLDOWN_FRAMES = 15;

function handShapeDistance(detected: HandPose, reference: HandPose): number {
  let totalWeight = 0;
  let totalDist = 0;

  const fingers: Array<"index" | "middle" | "ring" | "pinky"> = [
    "index",
    "middle",
    "ring",
    "pinky",
  ];

  for (const finger of fingers) {
    const dCurl = detected[finger].curl - reference[finger].curl;
    totalDist += dCurl * dCurl * WEIGHTS.curl;
    totalWeight += WEIGHTS.curl;

    const dSpread = detected[finger].spread - reference[finger].spread;
    totalDist += dSpread * dSpread * WEIGHTS.spread;
    totalWeight += WEIGHTS.spread;
  }

  const dThumbFlex = detected.thumb.flex - reference.thumb.flex;
  totalDist += dThumbFlex * dThumbFlex * WEIGHTS.thumbFlex;
  totalWeight += WEIGHTS.thumbFlex;

  const dThumbAbd = detected.thumb.abd - reference.thumb.abd;
  totalDist += dThumbAbd * dThumbAbd * WEIGHTS.thumbAbd;
  totalWeight += WEIGHTS.thumbAbd;

  if (reference.wristX !== undefined && detected.wristX !== undefined) {
    const dWristX = detected.wristX - reference.wristX;
    totalDist += dWristX * dWristX * WEIGHTS.wrist;
    totalWeight += WEIGHTS.wrist;
  }

  if (reference.wristY !== undefined && detected.wristY !== undefined) {
    const dWristY = detected.wristY - reference.wristY;
    totalDist += dWristY * dWristY * WEIGHTS.wrist;
    totalWeight += WEIGHTS.wrist;
  }

  if (reference.wristZ !== undefined && detected.wristZ !== undefined) {
    const dWristZ = detected.wristZ - reference.wristZ;
    totalDist += dWristZ * dWristZ * WEIGHTS.wrist;
    totalWeight += WEIGHTS.wrist;
  }

  return totalWeight > 0 ? Math.sqrt(totalDist / totalWeight) : 1;
}

function positionDistance(
  detected: HandRelativePos | null,
  reference: HandPose,
): number {
  if (!detected) return 0;
  if (reference.posY === undefined && reference.posX === undefined) return 0;

  let totalWeight = 0;
  let totalDist = 0;

  if (reference.posY !== undefined) {
    const dy = detected.posY - reference.posY;
    totalDist += dy * dy * WEIGHTS.posY;
    totalWeight += WEIGHTS.posY;
  }

  if (reference.posX !== undefined) {
    const dx = detected.posX - reference.posX;
    totalDist += dx * dx * WEIGHTS.posX;
    totalWeight += WEIGHTS.posX;
  }

  if (reference.posZ !== undefined) {
    const dz = detected.posZ - reference.posZ;
    totalDist += dz * dz * WEIGHTS.posZ;
    totalWeight += WEIGHTS.posZ;
  }

  return totalWeight > 0 ? Math.sqrt(totalDist / totalWeight) : 0;
}

function faceDistance(
  detected: FaceExpression | null,
  reference: FaceExpression | undefined,
): number {
  if (!detected || !reference) return 0;

  const dEyebrow = detected.eyebrowRaise - reference.eyebrowRaise;
  const dMouth = detected.mouthOpen - reference.mouthOpen;
  const dSmile = detected.mouthSmile - reference.mouthSmile;
  const dCheek = (detected.cheekPuff ?? 0) - (reference.cheekPuff ?? 0);
  const dSquint = (detected.eyeSquint ?? 0) - (reference.eyeSquint ?? 0);

  const sumSq =
    dEyebrow * dEyebrow +
    dMouth * dMouth +
    dSmile * dSmile +
    dCheek * dCheek * 0.5 +
    dSquint * dSquint * 0.5;

  return Math.sqrt(sumSq / 4) * WEIGHTS.face;
}

function combinedDistance(
  handDist: number,
  posDist: number,
  faceDist: number,
  hasPosition: boolean,
  hasFace: boolean,
): number {
  if (!hasPosition && !hasFace) return handDist;

  let total = handDist * 0.35;
  let totalWeight = 0.35;

  if (hasPosition) {
    total += posDist * 0.50;
    totalWeight += 0.50;
  }

  if (hasFace) {
    total += faceDist * 0.15;
    totalWeight += 0.15;
  }

  return total / totalWeight;
}

function positionRegion(pos: HandRelativePos | null): string {
  if (!pos) return "unknown";
  const y = pos.posY;
  if (y > 0.55) return "forehead";
  if (y > 0.42) return "face";
  if (y > 0.30) return "chin";
  if (y > 0.08) return "chest";
  return "low";
}

function refPositionRegion(pose: HandPose): string {
  const y = pose.posY;
  if (y === undefined) return "any";
  if (y > 0.55) return "forehead";
  if (y > 0.42) return "face";
  if (y > 0.30) return "chin";
  if (y > 0.08) return "chest";
  return "low";
}

export class SignMatcher {
  private stableSign: string | null = null;
  private stableCount = 0;
  private cooldownCounter = 0;
  private lastRecognized: string | null = null;

  match(input: FullMatchInput): MatchResult | null {
    if (this.cooldownCounter > 0) {
      this.cooldownCounter--;
      if (this.cooldownCounter === 0) {
        this.lastRecognized = null;
      }
    }

    const { right, left, rightHandPos, leftHandPos, detectedFace } = input;

    if (!right && !left) {
      this.stableSign = null;
      this.stableCount = 0;
      return null;
    }

    const dominantHand = right ?? left;
    const dominantPos = right ? rightHandPos : leftHandPos;
    if (!dominantHand) return null;

    const detectedRegion = positionRegion(dominantPos);

    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const [letter, pose] of Object.entries(FINGERSPELLING)) {
      const shapeDist = handShapeDistance(dominantHand, pose);
      if (shapeDist < bestDistance) {
        bestDistance = shapeDist;
        bestMatch = letter;
      }
    }

    for (const [word, sign] of Object.entries(WORD_SIGNS)) {
      if (sign.frames.length === 0) continue;
      const firstFrame = sign.frames[0];
      const refPose = firstFrame.right;

      const refRegion = refPositionRegion(refPose);
      if (
        dominantPos &&
        refRegion !== "any" &&
        detectedRegion !== "unknown" &&
        refRegion !== detectedRegion
      ) {
        const regionOrder = ["low", "chest", "chin", "face", "forehead"];
        const detIdx = regionOrder.indexOf(detectedRegion);
        const refIdx = regionOrder.indexOf(refRegion);
        if (Math.abs(detIdx - refIdx) > 1) continue;
      }

      const shapeDist = handShapeDistance(dominantHand, refPose);
      const posDist = positionDistance(dominantPos, refPose);
      const faceDist = faceDistance(detectedFace, firstFrame.face);

      const hasPos = refPose.posY !== undefined;
      const hasFace = firstFrame.face !== undefined &&
        (firstFrame.face.eyebrowRaise !== 0 ||
         firstFrame.face.mouthOpen > 0.1 ||
         firstFrame.face.mouthSmile !== 0);

      const dist = combinedDistance(shapeDist, posDist, faceDist, hasPos, hasFace);

      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = word;
      }
    }

    if (bestDistance > CONFIDENCE_THRESHOLD || !bestMatch) {
      this.stableSign = null;
      this.stableCount = 0;
      return null;
    }

    const confidence = 1 - bestDistance / CONFIDENCE_THRESHOLD;

    if (bestMatch === this.stableSign) {
      this.stableCount++;
    } else {
      this.stableSign = bestMatch;
      this.stableCount = 1;
    }

    if (this.stableCount >= STABILITY_FRAMES) {
      if (bestMatch !== this.lastRecognized || this.cooldownCounter === 0) {
        this.lastRecognized = bestMatch;
        this.cooldownCounter = COOLDOWN_FRAMES;
        this.stableCount = 0;
        return { word: bestMatch, confidence };
      }
    }

    return null;
  }

  reset(): void {
    this.stableSign = null;
    this.stableCount = 0;
    this.cooldownCounter = 0;
    this.lastRecognized = null;
  }
}
