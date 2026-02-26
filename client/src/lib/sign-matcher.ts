import type { HandPose, FaceExpression } from "./asl-poses";
import { FINGERSPELLING, WORD_SIGNS } from "./asl-poses";
import type { HandRelativePos } from "./pose-detector";

export interface MatchResult {
  word: string;
  confidence: number;
}

export interface MatchCandidate {
  word: string;
  distance: number;
  shapeDist: number;
  posDist: number;
}

export interface FullMatchInput {
  right: HandPose | null;
  left: HandPose | null;
  rightHandPos: HandRelativePos | null;
  leftHandPos: HandRelativePos | null;
  detectedFace: FaceExpression | null;
}

const CONFIDENCE_THRESHOLD = 0.40;
const STABILITY_FRAMES = 10;
const COOLDOWN_FRAMES = 10;
const HIGH_CONFIDENCE_RATIO = 0.45;
const HIGH_CONFIDENCE_STABILITY = 5;

const CALIBRATION_OFFSETS: Record<string, number> = {
  hello: -0.065,
  my: -0.055,
  name: -0.060,
  nice: -0.055,
  meet: -0.060,
  you: -0.050,
  please: -0.045,
  "thank you": -0.050,
  thanks: -0.050,
  help: -0.045,
  good: -0.040,
  sorry: -0.045,
  yes: -0.040,
  no: -0.040,
  love: -0.040,
  want: -0.035,
  need: -0.035,
  understand: -0.035,
  friend: -0.035,
  family: -0.030,
  water: -0.035,
  food: -0.030,
  home: -0.030,
};

const CONTEXT_PRIOR: Record<string, Record<string, number>> = {
  hello: { my: -0.025, nice: -0.020, you: -0.015 },
  my: { name: -0.030, friend: -0.015, family: -0.015, home: -0.010 },
  name: { nice: -0.020, you: -0.015 },
  nice: { meet: -0.030, "thank you": -0.015 },
  meet: { you: -0.030 },
  "thank you": { you: -0.015 },
  please: { help: -0.020 },
  i: { love: -0.020, need: -0.015, want: -0.015, understand: -0.015 },
  love: { you: -0.025, my: -0.015 },
  good: { morning: -0.015 },
  sorry: { please: -0.015 },
};

function handShapeDistance(detected: HandPose, reference: HandPose): number {
  let totalWeight = 0;
  let totalDist = 0;

  const fingers: Array<"index" | "middle" | "ring" | "pinky"> = [
    "index", "middle", "ring", "pinky",
  ];

  for (const finger of fingers) {
    const dCurl = detected[finger].curl - reference[finger].curl;
    totalDist += dCurl * dCurl * 1.0;
    totalWeight += 1.0;

    const dSpread = detected[finger].spread - reference[finger].spread;
    totalDist += dSpread * dSpread * 0.3;
    totalWeight += 0.3;
  }

  const dThumbFlex = detected.thumb.flex - reference.thumb.flex;
  totalDist += dThumbFlex * dThumbFlex * 0.9;
  totalWeight += 0.9;

  const dThumbAbd = detected.thumb.abd - reference.thumb.abd;
  totalDist += dThumbAbd * dThumbAbd * 0.6;
  totalWeight += 0.6;

  if (reference.wristX !== undefined && detected.wristX !== undefined) {
    const d = detected.wristX - reference.wristX;
    totalDist += d * d * 0.2;
    totalWeight += 0.2;
  }
  if (reference.wristY !== undefined && detected.wristY !== undefined) {
    const d = detected.wristY - reference.wristY;
    totalDist += d * d * 0.2;
    totalWeight += 0.2;
  }

  return totalWeight > 0 ? Math.sqrt(totalDist / totalWeight) : 1;
}

function positionDistance(
  detected: HandRelativePos | null,
  reference: HandPose,
): number {
  if (!detected) return 0;
  if (reference.posY === undefined && reference.posX === undefined) return 0;

  let sumSq = 0;
  let count = 0;

  if (reference.posY !== undefined) {
    const dy = detected.posY - reference.posY;
    sumSq += dy * dy * 3.0;
    count += 3.0;
  }

  if (reference.posX !== undefined) {
    const dx = detected.posX - reference.posX;
    sumSq += dx * dx * 1.0;
    count += 1.0;
  }

  if (reference.posZ !== undefined) {
    const dz = detected.posZ - reference.posZ;
    sumSq += dz * dz * 0.5;
    count += 0.5;
  }

  return count > 0 ? Math.sqrt(sumSq / count) : 0;
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

  return Math.sqrt(sumSq / 4);
}

function getRegionIndex(posY: number): number {
  if (posY > 0.55) return 4;
  if (posY > 0.42) return 3;
  if (posY > 0.25) return 2;
  if (posY > 0.05) return 1;
  return 0;
}

function regionLabel(posY: number): string {
  if (posY > 0.55) return "FOREHEAD";
  if (posY > 0.42) return "FACE";
  if (posY > 0.25) return "CHIN";
  if (posY > 0.05) return "CHEST";
  return "LOW";
}

export class SignMatcher {
  private stableSign: string | null = null;
  private stableCount = 0;
  private cooldownCounter = 0;
  private lastRecognized: string | null = null;
  private recentContext: string | null = null;
  public lastCandidates: MatchCandidate[] = [];
  public lastRegion: string = "";
  public lastPosY: number = 0;

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
      this.lastCandidates = [];
      return null;
    }

    const dominantHand = right ?? left;
    const dominantPos = right ? rightHandPos : leftHandPos;
    if (!dominantHand) return null;

    const detPosY = dominantPos?.posY ?? -0.08;
    const detRegionIdx = dominantPos ? getRegionIndex(detPosY) : -1;
    this.lastRegion = dominantPos ? regionLabel(detPosY) : "?";
    this.lastPosY = detPosY;

    const candidates: MatchCandidate[] = [];

    for (const [letter, pose] of Object.entries(FINGERSPELLING)) {
      let shapeDist = handShapeDistance(dominantHand, pose);
      if (dominantPos && detRegionIdx >= 3) {
        shapeDist += 0.15;
      } else if (dominantPos && detRegionIdx === 2) {
        shapeDist += 0.05;
      }
      const calibration = CALIBRATION_OFFSETS[letter] ?? 0;
      const contextBoost = this.getContextBoost(letter);
      const finalDist = Math.max(0, shapeDist + calibration + contextBoost);
      candidates.push({ word: letter, distance: finalDist, shapeDist, posDist: 0 });
    }

    for (const [word, sign] of Object.entries(WORD_SIGNS)) {
      if (sign.frames.length === 0) continue;
      const firstFrame = sign.frames[0];
      const refPose = firstFrame.right;

      const refHasPos = refPose.posY !== undefined;

      if (dominantPos && refHasPos) {
        const refRegionIdx = getRegionIndex(refPose.posY!);
        const regionDiff = Math.abs(detRegionIdx - refRegionIdx);
        if (regionDiff > 1) continue;
      }

      const shapeDist = handShapeDistance(dominantHand, refPose);
      const posDist = positionDistance(dominantPos, refPose);

      const hasFace = firstFrame.face !== undefined &&
        (Math.abs(firstFrame.face.eyebrowRaise) > 0.2 ||
         firstFrame.face.mouthOpen > 0.15 ||
         Math.abs(firstFrame.face.mouthSmile) > 0.2);
      const faceDist = hasFace ? faceDistance(detectedFace, firstFrame.face) : 0;

      let dist: number;
      if (refHasPos && dominantPos) {
        dist = shapeDist * 0.25 + posDist * 0.60 + faceDist * 0.15;
      } else if (refHasPos && !dominantPos) {
        dist = shapeDist * 0.85 + faceDist * 0.15;
      } else {
        dist = shapeDist * 0.85 + faceDist * 0.15;
        if (dominantPos && detRegionIdx >= 3) {
          dist += 0.18;
        } else if (dominantPos && detRegionIdx === 2) {
          dist += 0.08;
        }
      }

      const calibration = CALIBRATION_OFFSETS[word] ?? 0;
      const contextBoost = this.getContextBoost(word);
      dist = Math.max(0, dist + calibration + contextBoost);

      candidates.push({ word, distance: dist, shapeDist, posDist });
    }

    candidates.sort((a, b) => a.distance - b.distance);
    this.lastCandidates = candidates.slice(0, 5);

    const best = candidates[0];
    if (!best || best.distance > CONFIDENCE_THRESHOLD) {
      this.stableSign = null;
      this.stableCount = 0;
      return null;
    }

    const confidence = 1 - best.distance / CONFIDENCE_THRESHOLD;

    if (best.word === this.stableSign) {
      this.stableCount++;
    } else {
      this.stableSign = best.word;
      this.stableCount = 1;
    }

    const requiredFrames = best.distance < CONFIDENCE_THRESHOLD * HIGH_CONFIDENCE_RATIO
      ? HIGH_CONFIDENCE_STABILITY
      : STABILITY_FRAMES;

    if (this.stableCount >= requiredFrames) {
      if (best.word !== this.lastRecognized || this.cooldownCounter === 0) {
        this.recentContext = best.word;
        this.lastRecognized = best.word;
        this.cooldownCounter = COOLDOWN_FRAMES;
        this.stableCount = 0;
        return { word: best.word, confidence };
      }
    }

    return null;
  }

  private getContextBoost(candidate: string): number {
    if (!this.recentContext) return 0;
    const priors = CONTEXT_PRIOR[this.recentContext];
    if (!priors) return 0;
    return priors[candidate] ?? 0;
  }

  reset(): void {
    this.stableSign = null;
    this.stableCount = 0;
    this.cooldownCounter = 0;
    this.lastRecognized = null;
    this.recentContext = null;
    this.lastCandidates = [];
    this.lastRegion = "";
    this.lastPosY = 0;
  }
}
