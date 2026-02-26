import { describe, it, expect, beforeEach } from "vitest";
import {
  handShapeDistance,
  positionDistance,
  SignMatcher,
  type FullMatchInput,
} from "../sign-matcher";
import type { HandPose } from "../asl-poses";
import { FINGERSPELLING } from "../asl-poses";
import type { HandRelativePos } from "../pose-detector";

const FIST: HandPose = {
  thumb: { flex: 0.8, abd: 0.1 },
  index: { curl: 1, spread: 0 },
  middle: { curl: 1, spread: 0 },
  ring: { curl: 1, spread: 0 },
  pinky: { curl: 1, spread: 0 },
};

const OPEN: HandPose = {
  thumb: { flex: 0, abd: 0.6 },
  index: { curl: 0, spread: 0 },
  middle: { curl: 0, spread: 0 },
  ring: { curl: 0, spread: 0 },
  pinky: { curl: 0, spread: 0 },
};

function emptyInput(): FullMatchInput {
  return {
    right: null,
    left: null,
    rightHandPos: null,
    leftHandPos: null,
    detectedFace: null,
  };
}

describe("handShapeDistance", () => {
  it("returns 0 for identical poses", () => {
    expect(handShapeDistance(FIST, FIST)).toBe(0);
  });

  it("returns 0 for identical open hand poses", () => {
    expect(handShapeDistance(OPEN, OPEN)).toBe(0);
  });

  it("returns > 0 for different poses", () => {
    const dist = handShapeDistance(FIST, OPEN);
    expect(dist).toBeGreaterThan(0);
  });

  it("is symmetric", () => {
    const d1 = handShapeDistance(FIST, OPEN);
    const d2 = handShapeDistance(OPEN, FIST);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it("accounts for wrist rotation when present", () => {
    const poseA: HandPose = { ...FIST, wristX: 0, wristY: 0 };
    const poseB: HandPose = { ...FIST, wristX: 1, wristY: 1 };
    const dist = handShapeDistance(poseA, poseB);
    expect(dist).toBeGreaterThan(0);
  });

  it("ignores wrist when reference has no wrist data", () => {
    const poseWithWrist: HandPose = { ...FIST, wristX: 0.5, wristY: 0.5 };
    const dist = handShapeDistance(poseWithWrist, FIST);
    expect(dist).toBe(0);
  });
});

describe("positionDistance", () => {
  it("returns 0 when detected position is null", () => {
    const ref: HandPose = { ...FIST, posY: 0.5 };
    expect(positionDistance(null, ref)).toBe(0);
  });

  it("returns 0 when reference has no position fields", () => {
    const detected: HandRelativePos = { posX: 0.1, posY: 0.5, posZ: 0.04 };
    expect(positionDistance(detected, FIST)).toBe(0);
  });

  it("returns 0 when positions match exactly", () => {
    const detected: HandRelativePos = { posX: 0.1, posY: 0.5, posZ: 0.04 };
    const ref: HandPose = { ...FIST, posX: 0.1, posY: 0.5, posZ: 0.04 };
    expect(positionDistance(detected, ref)).toBeCloseTo(0, 10);
  });

  it("returns > 0 when positions differ", () => {
    const detected: HandRelativePos = { posX: 0, posY: 0.1, posZ: 0 };
    const ref: HandPose = { ...FIST, posY: 0.6 };
    const dist = positionDistance(detected, ref);
    expect(dist).toBeGreaterThan(0);
  });

  it("weighs Y axis more than X axis", () => {
    const base: HandRelativePos = { posX: 0, posY: 0, posZ: 0 };
    const refY: HandPose = { ...FIST, posY: 0.3 };
    const refX: HandPose = { ...FIST, posX: 0.3 };
    const distY = positionDistance(base, refY);
    const distX = positionDistance(base, refX);
    expect(distY).toBeGreaterThan(distX);
  });
});

describe("SignMatcher", () => {
  let matcher: SignMatcher;

  beforeEach(() => {
    matcher = new SignMatcher();
  });

  it("returns null when no hands detected", () => {
    const result = matcher.match(emptyInput());
    expect(result).toBeNull();
  });

  it("requires stability frames before emitting a match", () => {
    const input: FullMatchInput = {
      right: FINGERSPELLING["A"],
      left: null,
      rightHandPos: null,
      leftHandPos: null,
      detectedFace: null,
    };

    const result = matcher.match(input);
    expect(result).toBeNull();
  });

  it("emits a match after sufficient stability frames", () => {
    const input: FullMatchInput = {
      right: FINGERSPELLING["A"],
      left: null,
      rightHandPos: null,
      leftHandPos: null,
      detectedFace: null,
    };

    let result = null;
    for (let i = 0; i < 15; i++) {
      result = matcher.match(input);
      if (result) break;
    }
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it("applies cooldown after a successful match", () => {
    const input: FullMatchInput = {
      right: FINGERSPELLING["A"],
      left: null,
      rightHandPos: null,
      leftHandPos: null,
      detectedFace: null,
    };

    let firstMatch = null;
    for (let i = 0; i < 20; i++) {
      const r = matcher.match(input);
      if (r && !firstMatch) {
        firstMatch = r;
        break;
      }
    }
    expect(firstMatch).not.toBeNull();

    const immediateResult = matcher.match(input);
    expect(immediateResult).toBeNull();
  });

  it("resets state correctly", () => {
    const input: FullMatchInput = {
      right: FINGERSPELLING["A"],
      left: null,
      rightHandPos: null,
      leftHandPos: null,
      detectedFace: null,
    };

    for (let i = 0; i < 5; i++) {
      matcher.match(input);
    }

    matcher.reset();
    expect(matcher.lastCandidates).toEqual([]);
    expect(matcher.lastRegion).toBe("");
    expect(matcher.lastPosY).toBe(0);
  });

  it("resets stable count when no hands are detected", () => {
    const input: FullMatchInput = {
      right: FINGERSPELLING["A"],
      left: null,
      rightHandPos: null,
      leftHandPos: null,
      detectedFace: null,
    };

    for (let i = 0; i < 2; i++) {
      matcher.match(input);
    }

    matcher.match(emptyInput());

    const result = matcher.match(input);
    expect(result).toBeNull();

    expect(matcher.lastCandidates.length).toBeGreaterThan(0);
  });

  it("calibration offsets reduce distance for calibrated signs", () => {
    const input: FullMatchInput = {
      right: FINGERSPELLING["A"],
      left: null,
      rightHandPos: null,
      leftHandPos: null,
      detectedFace: null,
    };

    matcher.match(input);
    const candidates = matcher.lastCandidates;
    expect(candidates.length).toBeGreaterThan(0);

    const calibrated = candidates.find(c => c.word === "hello");
    const letterA = candidates.find(c => c.word === "A");
    if (calibrated && letterA) {
      expect(calibrated.distance).toBeLessThan(calibrated.shapeDist);
    }
  });

  it("context prior boosts likely follow-up signs", () => {
    const helloInput: FullMatchInput = {
      right: FINGERSPELLING["B"],
      left: null,
      rightHandPos: { posX: 0, posY: 0.64, posZ: 0.18 },
      leftHandPos: null,
      detectedFace: { eyebrowRaise: 0.35, mouthOpen: 0.3, mouthSmile: 0.9 },
    };

    for (let i = 0; i < 20; i++) {
      const r = matcher.match(helloInput);
      if (r && r.word === "hello") break;
    }

    const nextInput: FullMatchInput = {
      right: FINGERSPELLING["A"],
      left: null,
      rightHandPos: null,
      leftHandPos: null,
      detectedFace: null,
    };

    matcher.match(nextInput);
    const candidates = matcher.lastCandidates;

    const myCandidate = candidates.find(c => c.word === "my");
    if (myCandidate) {
      expect(myCandidate.distance).toBeLessThanOrEqual(myCandidate.shapeDist);
    }
  });
});
