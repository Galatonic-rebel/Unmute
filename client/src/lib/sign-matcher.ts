import type { HandPose, FaceExpression } from "./asl-poses";
import { FINGERSPELLING, WORD_SIGNS } from "./asl-poses";
import type { HandRelativePos } from "./pose-detector";

/** Result of a successful sign recognition, containing the matched word and confidence score. */
export interface MatchResult {
  word: string;
  confidence: number;
}

/** Intermediate candidate during sign matching, storing distance metrics for ranking. */
export interface MatchCandidate {
  word: string;
  /** Combined weighted distance (lower = better match). */
  distance: number;
  /** Hand shape distance component only. */
  shapeDist: number;
  /** Hand position distance component only. */
  posDist: number;
}

export interface SignMatcherOptions {
  /**
   * Restrict the word-match pool to these WORD_SIGNS keys.
   * Keys that do not exist in the dictionary are ignored with a console warning.
   * Omit to match against the full dictionary (default, unchanged behavior).
   */
  vocabulary?: string[];
  /**
   * Include A–Z fingerspelling handshapes as candidates.
   * Note: letter candidates currently score with posDist 0, which makes them
   * out-rank real word signs for many open-hand shapes. Set false for
   * constrained-vocabulary recognition (prototype). Default: true.
   */
  includeLetters?: boolean;
}

/**
 * Complete input for a single frame of sign detection.
 * Includes hand poses, spatial positions relative to body, and facial expression.
 */
export interface FullMatchInput {
  right: HandPose | null;
  left: HandPose | null;
  rightHandPos: HandRelativePos | null;
  leftHandPos: HandRelativePos | null;
  detectedFace: FaceExpression | null;
}

/** Maximum distance threshold; candidates above this are rejected. */
const CONFIDENCE_THRESHOLD = 0.42;
/** Number of consecutive frames a sign must be the top candidate before recognition fires. */
const STABILITY_FRAMES = 10;
/** Cooldown frames after a recognition event to prevent immediate re-triggering. */
const COOLDOWN_FRAMES = 8;
/** Distance ratio below which high-confidence fast-path triggers (fewer stability frames). */
const HIGH_CONFIDENCE_RATIO = 0.50;
/** Reduced stability frame requirement for high-confidence matches. */
const HIGH_CONFIDENCE_STABILITY = 4;
/** Margin within which a calibrated sign can overtake an uncalibrated top candidate. */
const RERANK_MARGIN = 0.08;

/**
 * Per-sign distance offsets that bias matching toward commonly-used signs.
 * Negative values reduce distance, making the sign easier to recognize.
 * Tuned empirically during user testing sessions.
 */
const CALIBRATION_OFFSETS: Record<string, number> = {
  hello: -0.10,
  my: -0.10,
  name: -0.10,
  nice: -0.08,
  meet: -0.09,
  you: -0.08,
  please: -0.06,
  "thank you": -0.07,
  thanks: -0.07,
  help: -0.06,
  good: -0.06,
  sorry: -0.06,
  yes: -0.05,
  no: -0.05,
  love: -0.06,
  understand: -0.04,
  friend: -0.04,
  family: -0.04,
  water: -0.04,
  food: -0.04,
  home: -0.04,
};

/**
 * Contextual prior map: after recognizing a sign (key), subsequent signs (inner keys)
 * receive a distance bonus (negative = easier to match), modelling ASL phrase patterns.
 * Example: after "hello", "my" gets a -0.04 boost since "hello my name" is common.
 */
const CONTEXT_PRIOR: Record<string, Record<string, number>> = {
  hello: { my: -0.04, nice: -0.03, you: -0.02 },
  my: { name: -0.05, friend: -0.02, family: -0.02, home: -0.02 },
  name: { nice: -0.03, you: -0.02 },
  nice: { meet: -0.05, "thank you": -0.02 },
  meet: { you: -0.05 },
  "thank you": { you: -0.02 },
  please: { help: -0.03 },
  i: { love: -0.03, need: -0.02, want: -0.02, understand: -0.02 },
  love: { you: -0.04, my: -0.02 },
  good: { morning: -0.02 },
  sorry: { please: -0.02 },
};

/**
 * Computes weighted Euclidean distance between two hand poses based on finger curl,
 * spread, thumb flex/abduction, and optional wrist rotation.
 *
 * Weights: finger curl (1.0), spread (0.3), thumb flex (0.9), thumb abd (0.6), wrist (0.2).
 * Returns normalized RMS distance in [0, ~1+] range.
 *
 * @param detected - Hand pose extracted from camera via MediaPipe
 * @param reference - Reference hand pose from the ASL dictionary
 * @returns Weighted RMS distance (0 = identical poses)
 */
export function handShapeDistance(detected: HandPose, reference: HandPose): number {
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

/**
 * Computes spatial distance between detected hand position and reference sign position.
 * Uses body-relative coordinates (posY = vertical region, posX = lateral, posZ = depth).
 *
 * Weights: vertical (3.0) >> lateral (1.0) > depth (0.5), reflecting that
 * vertical position carries the most semantic information in ASL.
 *
 * @param detected - Body-relative hand position from PoseDetector, or null if unavailable
 * @param reference - Reference pose containing expected position fields
 * @returns Weighted RMS position distance, or 0 if position data is unavailable
 */
export function positionDistance(
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

/**
 * Computes distance between detected and reference facial expressions.
 * Considers eyebrow raise, mouth open/smile, cheek puff (weight 0.5), and eye squint (weight 0.5).
 *
 * @param detected - Facial expression from FaceLandmarker blendshapes
 * @param reference - Expected facial expression for the sign, or undefined if face is irrelevant
 * @returns RMS face expression distance, or 0 if either input is null/undefined
 */
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

/**
 * Maps vertical hand position to a discrete signing region index (0-4).
 * Regions: 0=LOW (<0.05), 1=CHEST, 2=CHIN, 3=FACE, 4=FOREHEAD (>0.55).
 * Used for coarse region filtering to skip unlikely candidates.
 */
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

function hasCalibration(word: string): boolean {
  return word in CALIBRATION_OFFSETS;
}

/**
 * Stateful ASL sign matcher that processes per-frame hand/body/face data
 * and emits recognized signs with temporal stability filtering.
 *
 * Algorithm overview:
 * 1. For each frame, compute distance to all known signs (fingerspelling + word signs)
 * 2. Apply calibration offsets and contextual priors to distances
 * 3. Re-rank: prefer calibrated signs within RERANK_MARGIN of the top candidate
 * 4. Require STABILITY_FRAMES consecutive frames as top candidate before firing
 *    (HIGH_CONFIDENCE_STABILITY for very confident matches)
 * 5. Enforce COOLDOWN_FRAMES between recognitions to avoid duplicates
 */
export class SignMatcher {
  private stableSign: string | null = null;
  private stableCount = 0;
  private cooldownCounter = 0;
  private lastRecognized: string | null = null;
  private recentContext: string | null = null;
  public lastCandidates: MatchCandidate[] = [];
  public lastRegion: string = "";
  public lastPosY: number = 0;

  /** Word-sign pool actually used for matching (whole dictionary unless restricted). */
  private activeWords: Record<string, typeof WORD_SIGNS[string]>;
  /** Fingerspelling pool, or null when letters are excluded. */
  private activeLetters: Record<string, typeof FINGERSPELLING[string]> | null;

  constructor(options: SignMatcherOptions = {}) {
    if (options.vocabulary) {
      this.activeWords = {};
      for (const word of options.vocabulary) {
        if (word in WORD_SIGNS) {
          this.activeWords[word] = WORD_SIGNS[word];
        } else {
          console.warn("SignMatcher: vocabulary word not in dictionary:", word);
        }
      }
    } else {
      this.activeWords = WORD_SIGNS;
    }
    this.activeLetters = options.includeLetters === false ? null : FINGERSPELLING;
  }

  /**
   * Process a single frame of detection data and return a recognized sign if
   * the stability and confidence criteria are met.
   *
   * @param input - Complete frame data including hand poses, positions, and face
   * @returns MatchResult with word and confidence if a sign is recognized, null otherwise
   */
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

    if (this.activeLetters) {
      for (const [letter, pose] of Object.entries(this.activeLetters)) {
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
    }

    for (const [word, sign] of Object.entries(this.activeWords)) {
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

    const top = candidates[0];
    if (top && !hasCalibration(top.word)) {
      const preferred = candidates.find(
        c => hasCalibration(c.word) && c.distance <= top.distance + RERANK_MARGIN
      );
      if (preferred) {
        const idx = candidates.indexOf(preferred);
        candidates.splice(idx, 1);
        candidates.unshift(preferred);
      }
    }

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

  /**
   * Retrieves the contextual distance boost for a candidate sign based on the
   * most recently recognized sign. Returns a negative value (distance reduction)
   * if the candidate is a likely successor in common ASL phrases.
   */
  private getContextBoost(candidate: string): number {
    if (!this.recentContext) return 0;
    const priors = CONTEXT_PRIOR[this.recentContext];
    if (!priors) return 0;
    return priors[candidate] ?? 0;
  }

  /** Resets all internal state (stability counters, context, candidates). */
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
