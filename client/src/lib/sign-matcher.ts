import type { HandPose } from "./asl-poses";
import { FINGERSPELLING, WORD_SIGNS } from "./asl-poses";

export interface MatchResult {
  word: string;
  confidence: number;
}

const WEIGHTS = {
  curl: 1.0,
  spread: 0.5,
  thumbFlex: 1.0,
  thumbAbd: 0.8,
  wrist: 0.4,
};

const CONFIDENCE_THRESHOLD = 0.3;
const STABILITY_FRAMES = 8;
const COOLDOWN_FRAMES = 12;

function handPoseDistance(detected: HandPose, reference: HandPose): number {
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

export class SignMatcher {
  private stableSign: string | null = null;
  private stableCount = 0;
  private cooldownCounter = 0;
  private lastRecognized: string | null = null;

  match(
    right: HandPose | null,
    left: HandPose | null,
  ): MatchResult | null {
    if (this.cooldownCounter > 0) {
      this.cooldownCounter--;
      if (this.cooldownCounter === 0) {
        this.lastRecognized = null;
      }
    }

    if (!right && !left) {
      this.stableSign = null;
      this.stableCount = 0;
      return null;
    }

    const dominantHand = right ?? left;
    if (!dominantHand) return null;

    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const [letter, pose] of Object.entries(FINGERSPELLING)) {
      const dist = handPoseDistance(dominantHand, pose);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = letter;
      }
    }

    for (const [word, sign] of Object.entries(WORD_SIGNS)) {
      if (sign.frames.length === 0) continue;
      const firstFrame = sign.frames[0];
      const refPose = firstFrame.right;

      const dist = handPoseDistance(dominantHand, refPose);
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
