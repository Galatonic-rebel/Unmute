// ASL Pose Data - Complete fingerspelling A-Z and common word signs

export interface FingerState {
  curl: number;   // 0 = open/straight, 1 = fully curled
  spread: number; // -1 = spread, 0 = neutral, 1 = adducted
}

export interface ThumbState {
  flex: number;   // 0 = straight/open, 1 = curled
  abd: number;    // 0 = folded in, 1 = fully abducted
}

export interface HandPose {
  thumb: ThumbState;
  index: FingerState;
  middle: FingerState;
  ring: FingerState;
  pinky: FingerState;
  wristX?: number;
  wristY?: number;
  wristZ?: number;
}

export interface FaceExpression {
  eyebrowRaise: number;
  mouthOpen: number;
  mouthSmile: number;
  headTiltX?: number;
  headTiltY?: number;
  cheekPuff?: number;
  eyeSquint?: number;
}

export interface SignKeyframe {
  right: HandPose;
  left: HandPose;
  face?: FaceExpression;
  holdMs: number;
}

export interface WordSign {
  frames: SignKeyframe[];
}

// --- Base poses ---
export const OPEN: HandPose = {
  thumb: { flex: 0, abd: 0.8 },
  index: { curl: 0, spread: 0 },
  middle: { curl: 0, spread: 0 },
  ring: { curl: 0, spread: 0 },
  pinky: { curl: 0, spread: 0 },
};

export const FIST: HandPose = {
  thumb: { flex: 0.8, abd: 0.2 },
  index: { curl: 1, spread: 0 },
  middle: { curl: 1, spread: 0 },
  ring: { curl: 1, spread: 0 },
  pinky: { curl: 1, spread: 0 },
};

const FLAT_B: HandPose = {
  thumb: { flex: 0.7, abd: 0 },
  index: { curl: 0, spread: 0 },
  middle: { curl: 0, spread: 0 },
  ring: { curl: 0, spread: 0 },
  pinky: { curl: 0, spread: 0 },
};

const CURVED: HandPose = {
  thumb: { flex: 0.3, abd: 0.6 },
  index: { curl: 0.3, spread: -0.1 },
  middle: { curl: 0.3, spread: 0 },
  ring: { curl: 0.3, spread: 0 },
  pinky: { curl: 0.3, spread: 0 },
};

const O_SHAPE: HandPose = {
  thumb: { flex: 0.5, abd: 0.4 },
  index: { curl: 0.6, spread: 0 },
  middle: { curl: 0.6, spread: 0 },
  ring: { curl: 0.6, spread: 0 },
  pinky: { curl: 0.6, spread: 0 },
};

const Y_SHAPE: HandPose = {
  thumb: { flex: 0, abd: 1 },
  index: { curl: 0.9, spread: 0 },
  middle: { curl: 0.9, spread: 0 },
  ring: { curl: 0.9, spread: 0 },
  pinky: { curl: 0, spread: 0 },
};

const V_SHAPE: HandPose = {
  thumb: { flex: 0.7, abd: 0 },
  index: { curl: 0, spread: -0.3 },
  middle: { curl: 0, spread: 0.3 },
  ring: { curl: 0.9, spread: 0 },
  pinky: { curl: 0.9, spread: 0 },
};

const POINT_UP: HandPose = {
  thumb: { flex: 0.6, abd: 0.2 },
  index: { curl: 0, spread: 0 },
  middle: { curl: 0.9, spread: 0 },
  ring: { curl: 0.9, spread: 0 },
  pinky: { curl: 0.9, spread: 0 },
};

// --- Face expressions ---
export const NEUTRAL_FACE: FaceExpression = {
  eyebrowRaise: 0, mouthOpen: 0, mouthSmile: 0.1,
  headTiltX: 0, headTiltY: 0, cheekPuff: 0, eyeSquint: 0,
};

export const QUESTION_FACE: FaceExpression = {
  eyebrowRaise: 0.8, mouthOpen: 0.2, mouthSmile: 0,
  headTiltX: 0, headTiltY: 0.3, cheekPuff: 0, eyeSquint: 0,
};

export const HAPPY_FACE: FaceExpression = {
  eyebrowRaise: 0.3, mouthOpen: 0.3, mouthSmile: 0.8,
  headTiltX: 0, headTiltY: 0, cheekPuff: 0, eyeSquint: 0.4,
};

export const SAD_FACE: FaceExpression = {
  eyebrowRaise: -0.5, mouthOpen: 0.1, mouthSmile: -0.7,
  headTiltX: 0.1, headTiltY: 0, cheekPuff: 0, eyeSquint: 0,
};

export const ANGRY_FACE: FaceExpression = {
  eyebrowRaise: -0.7, mouthOpen: 0.3, mouthSmile: -0.5,
  headTiltX: 0, headTiltY: 0, cheekPuff: 0, eyeSquint: 0.5,
};

// --- Helpers ---
function staticSign(right: HandPose, left: HandPose, face?: FaceExpression, holdMs = 600): WordSign {
  return { frames: [{ right, left, face: face ?? NEUTRAL_FACE, holdMs }] };
}

function animSign(frames: SignKeyframe[]): WordSign {
  return { frames };
}

// ============================================================
// ASL Fingerspelling A-Z (right-hand dominant)
// ============================================================
export const FINGERSPELLING: Record<string, HandPose> = {
  A: { thumb: { flex: 0.3, abd: 0.3 }, index: { curl: 0.95, spread: 0 }, middle: { curl: 0.95, spread: 0 }, ring: { curl: 0.95, spread: 0 }, pinky: { curl: 0.95, spread: 0 } },
  B: { thumb: { flex: 0.7, abd: 0 }, index: { curl: 0, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0, spread: 0 }, pinky: { curl: 0, spread: 0 } },
  C: { thumb: { flex: 0.4, abd: 0.5 }, index: { curl: 0.45, spread: 0 }, middle: { curl: 0.45, spread: 0 }, ring: { curl: 0.45, spread: 0 }, pinky: { curl: 0.45, spread: 0 } },
  D: { thumb: { flex: 0.4, abd: 0.3 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.85, spread: 0 }, ring: { curl: 0.85, spread: 0 }, pinky: { curl: 0.85, spread: 0 } },
  E: { thumb: { flex: 0.9, abd: 0 }, index: { curl: 0.6, spread: 0 }, middle: { curl: 0.6, spread: 0 }, ring: { curl: 0.6, spread: 0 }, pinky: { curl: 0.6, spread: 0 } },
  F: { thumb: { flex: 0.3, abd: 0.6 }, index: { curl: 0.7, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0, spread: 0 }, pinky: { curl: 0, spread: 0 } },
  G: { thumb: { flex: 0, abd: 0.6 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 }, wristY: -0.5 },
  H: { thumb: { flex: 0.7, abd: 0 }, index: { curl: 0, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 }, wristY: -0.5 },
  I: { thumb: { flex: 0.6, abd: 0.2 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0, spread: 0 } },
  J: { thumb: { flex: 0.6, abd: 0.2 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0, spread: 0 } },
  K: { thumb: { flex: 0.2, abd: 0.5 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.1, spread: -0.3 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  L: { thumb: { flex: 0, abd: 1 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  M: { thumb: { flex: 0.8, abd: 0 }, index: { curl: 0.7, spread: 0 }, middle: { curl: 0.7, spread: 0 }, ring: { curl: 0.7, spread: 0 }, pinky: { curl: 0.8, spread: 0 } },
  N: { thumb: { flex: 0.8, abd: 0 }, index: { curl: 0.7, spread: 0 }, middle: { curl: 0.7, spread: 0 }, ring: { curl: 0.85, spread: 0 }, pinky: { curl: 0.85, spread: 0 } },
  O: { thumb: { flex: 0.5, abd: 0.4 }, index: { curl: 0.6, spread: 0 }, middle: { curl: 0.6, spread: 0 }, ring: { curl: 0.6, spread: 0 }, pinky: { curl: 0.6, spread: 0 } },
  P: { thumb: { flex: 0.2, abd: 0.5 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.1, spread: -0.3 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 }, wristX: 0.4 },
  Q: { thumb: { flex: 0, abd: 0.6 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 }, wristX: 0.4 },
  R: { thumb: { flex: 0.7, abd: 0 }, index: { curl: 0, spread: 0.2 }, middle: { curl: 0, spread: -0.2 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  S: { thumb: { flex: 0.7, abd: 0.1 }, index: { curl: 1, spread: 0 }, middle: { curl: 1, spread: 0 }, ring: { curl: 1, spread: 0 }, pinky: { curl: 1, spread: 0 } },
  T: { thumb: { flex: 0.5, abd: 0.2 }, index: { curl: 0.8, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  U: { thumb: { flex: 0.7, abd: 0 }, index: { curl: 0, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  V: { thumb: { flex: 0.7, abd: 0 }, index: { curl: 0, spread: -0.3 }, middle: { curl: 0, spread: 0.3 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  W: { thumb: { flex: 0.7, abd: 0 }, index: { curl: 0, spread: -0.4 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0, spread: 0.4 }, pinky: { curl: 0.9, spread: 0 } },
  X: { thumb: { flex: 0.6, abd: 0.3 }, index: { curl: 0.5, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  Y: { thumb: { flex: 0, abd: 1 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0, spread: 0 } },
  Z: { thumb: { flex: 0.7, abd: 0 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
};

// ============================================================
// Word Sign Dictionary
// ============================================================
export const WORD_SIGNS: Record<string, WordSign> = {
  // Greetings
  hello: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 300 },
    { right: { ...FLAT_B, wristZ: 0.35 }, left: FIST, face: NEUTRAL_FACE, holdMs: 500 },
  ]),
  hi: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
    { right: { ...FLAT_B, wristZ: 0.4 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  goodbye: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 250 },
    { right: { ...FLAT_B, wristX: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 250 },
    { right: FINGERSPELLING.B, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  bye: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 350 },
    { right: { ...FLAT_B, wristZ: 0.5 }, left: FIST, face: NEUTRAL_FACE, holdMs: 450 },
  ]),

  // Pronouns
  i: staticSign(POINT_UP, FIST),
  me: staticSign(POINT_UP, FIST),
  you: staticSign({ ...POINT_UP, wristZ: 0.2 }, FIST),
  we: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 300 },
    { right: { ...POINT_UP, wristY: 0.4 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  they: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 300 },
    { right: { ...POINT_UP, wristY: -0.4 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  he: staticSign(POINT_UP, FIST),
  she: staticSign(POINT_UP, FIST),
  it: staticSign(POINT_UP, FIST),

  // Affirmations / negations
  yes: animSign([
    { right: FIST, left: FIST, face: NEUTRAL_FACE, holdMs: 250 },
    { right: { ...FIST, wristX: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 250 },
    { right: FIST, left: FIST, face: NEUTRAL_FACE, holdMs: 250 },
  ]),
  no: animSign([
    { right: FINGERSPELLING.N, left: FIST, face: NEUTRAL_FACE, holdMs: 300 },
    { right: FINGERSPELLING.O, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  please: staticSign(FLAT_B, FIST, { ...NEUTRAL_FACE, mouthSmile: 0.4 }),
  sorry: animSign([
    { right: FINGERSPELLING.A, left: FIST, face: SAD_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.A, wristX: 0.2 }, left: FIST, face: SAD_FACE, holdMs: 280 },
    { right: FINGERSPELLING.A, left: FIST, face: SAD_FACE, holdMs: 280 },
  ]),
  'thank you': animSign([
    { right: FLAT_B, left: FIST, face: HAPPY_FACE, holdMs: 300 },
    { right: { ...FLAT_B, wristX: 0.35 }, left: FIST, face: HAPPY_FACE, holdMs: 500 },
  ]),
  thanks: animSign([
    { right: FLAT_B, left: FIST, face: HAPPY_FACE, holdMs: 300 },
    { right: { ...FLAT_B, wristX: 0.35 }, left: FIST, face: HAPPY_FACE, holdMs: 500 },
  ]),

  // Questions
  what: animSign([
    { right: FLAT_B, left: FIST, face: QUESTION_FACE, holdMs: 300 },
    { right: { ...FLAT_B, wristX: 0.2 }, left: FIST, face: QUESTION_FACE, holdMs: 400 },
  ]),
  where: animSign([
    { right: POINT_UP, left: FIST, face: QUESTION_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.3 }, left: FIST, face: QUESTION_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: -0.3 }, left: FIST, face: QUESTION_FACE, holdMs: 280 },
  ]),
  when: staticSign(POINT_UP, POINT_UP, QUESTION_FACE),
  who: staticSign(POINT_UP, FIST, QUESTION_FACE),
  why: animSign([
    { right: FLAT_B, left: FIST, face: QUESTION_FACE, holdMs: 280 },
    { right: Y_SHAPE, left: FIST, face: QUESTION_FACE, holdMs: 400 },
  ]),
  how: animSign([
    { right: CURVED, left: CURVED, face: QUESTION_FACE, holdMs: 280 },
    { right: FLAT_B, left: FLAT_B, face: QUESTION_FACE, holdMs: 400 },
  ]),

  // Emotions
  happy: animSign([
    { right: FLAT_B, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.2 }, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: FLAT_B, left: FIST, face: HAPPY_FACE, holdMs: 280 },
  ]),
  sad: animSign([
    { right: FLAT_B, left: FLAT_B, face: SAD_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: -0.25 }, left: { ...FLAT_B, wristX: -0.25 }, face: SAD_FACE, holdMs: 400 },
  ]),
  love: staticSign(FINGERSPELLING.A, FINGERSPELLING.A, { ...HAPPY_FACE, mouthSmile: 0.9 }, 700),
  angry: animSign([
    { right: CURVED, left: FIST, face: ANGRY_FACE, holdMs: 280 },
    { right: FIST, left: FIST, face: ANGRY_FACE, holdMs: 400 },
  ]),
  good: animSign([
    { right: FLAT_B, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.2 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 400 },
  ]),
  bad: animSign([
    { right: FLAT_B, left: FIST, face: SAD_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: -0.4 }, left: FIST, face: SAD_FACE, holdMs: 400 },
  ]),
  great: animSign([
    { right: OPEN, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...OPEN, wristX: 0.2 }, left: FIST, face: HAPPY_FACE, holdMs: 400 },
  ]),
  beautiful: animSign([
    { right: O_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: OPEN, left: FIST, face: HAPPY_FACE, holdMs: 400 },
  ]),

  // Time
  today: animSign([
    { right: Y_SHAPE, left: Y_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...Y_SHAPE, wristX: 0.2 }, left: { ...Y_SHAPE, wristX: 0.2 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  tomorrow: animSign([
    { right: FINGERSPELLING.A, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.A, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  yesterday: animSign([
    { right: FINGERSPELLING.A, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.A, wristZ: -0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  now: animSign([
    { right: Y_SHAPE, left: Y_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...Y_SHAPE, wristX: 0.2 }, left: { ...Y_SHAPE, wristX: 0.2 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  later: animSign([
    { right: FINGERSPELLING.L, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.L, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  before: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: -0.3 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  after: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: 0.3 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 400 },
  ]),

  // Actions
  help: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.3 }, left: { ...FLAT_B, wristX: 0.3 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  stop: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.4 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  go: animSign([
    { right: POINT_UP, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.3 }, left: { ...POINT_UP, wristZ: 0.3 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  come: animSign([
    { right: POINT_UP, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: -0.3 }, left: { ...POINT_UP, wristZ: -0.3 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  want: animSign([
    { right: CURVED, left: CURVED, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FIST, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  need: animSign([
    { right: FINGERSPELLING.X, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.X, wristX: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  know: staticSign(FLAT_B, FIST),
  understand: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristX: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  more: animSign([
    { right: O_SHAPE, left: O_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: O_SHAPE, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  again: animSign([
    { right: CURVED, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  eat: animSign([
    { right: O_SHAPE, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.3 }, holdMs: 280 },
    { right: { ...O_SHAPE, wristX: 0.2 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.4 }, holdMs: 400 },
  ]),
  drink: animSign([
    { right: CURVED, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.3 }, holdMs: 280 },
    { right: { ...CURVED, wristX: 0.3 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.4 }, holdMs: 400 },
  ]),
  see: staticSign(V_SHAPE, FIST),
  hear: staticSign(POINT_UP, FIST),
  speak: animSign([
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.3 }, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.2 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.3 }, holdMs: 400 },
  ]),
  sign: animSign([
    { right: POINT_UP, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.3 }, left: { ...POINT_UP, wristZ: -0.3 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  sleep: animSign([
    { right: OPEN, left: FIST, face: { ...NEUTRAL_FACE, eyeSquint: 1 }, holdMs: 280 },
    { right: { ...OPEN, wristX: 0.3 }, left: FIST, face: { ...NEUTRAL_FACE, eyeSquint: 1 }, holdMs: 400 },
  ]),
  learn: animSign([
    { right: O_SHAPE, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.3 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  work: animSign([
    { right: FINGERSPELLING.S, left: FINGERSPELLING.S, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.S, wristX: 0.2 }, left: FINGERSPELLING.S, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FINGERSPELLING.S, left: FINGERSPELLING.S, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  play: animSign([
    { right: Y_SHAPE, left: Y_SHAPE, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...Y_SHAPE, wristZ: 0.3 }, left: { ...Y_SHAPE, wristZ: -0.3 }, face: HAPPY_FACE, holdMs: 280 },
    { right: Y_SHAPE, left: Y_SHAPE, face: HAPPY_FACE, holdMs: 280 },
  ]),

  // People
  name: animSign([
    { right: FINGERSPELLING.H, left: FINGERSPELLING.H, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.H, wristX: 0.2 }, left: { ...FINGERSPELLING.H, wristX: 0.2 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  friend: staticSign(FINGERSPELLING.H, FINGERSPELLING.H, HAPPY_FACE),
  family: animSign([
    { right: FINGERSPELLING.F, left: FINGERSPELLING.F, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.F, wristZ: 0.4 }, left: { ...FINGERSPELLING.F, wristZ: -0.4 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  mother: animSign([
    { right: FINGERSPELLING.A, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FINGERSPELLING.M, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  father: animSign([
    { right: FINGERSPELLING.F, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  baby: animSign([
    { right: CURVED, left: CURVED, face: { ...NEUTRAL_FACE, mouthSmile: 0.5 }, holdMs: 280 },
    { right: { ...CURVED, wristX: 0.2 }, left: { ...CURVED, wristX: 0.2 }, face: { ...NEUTRAL_FACE, mouthSmile: 0.5 }, holdMs: 400 },
  ]),

  // Objects / Places
  water: animSign([
    { right: FINGERSPELLING.W, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.W, wristX: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  food: animSign([
    { right: O_SHAPE, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.2 }, holdMs: 280 },
    { right: { ...O_SHAPE, wristX: 0.2 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.3 }, holdMs: 400 },
  ]),
  house: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: 0.3 }, left: { ...FLAT_B, wristZ: -0.3 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  school: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.3 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  book: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: 0.4 }, left: { ...FLAT_B, wristZ: -0.4 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),

  // Adjectives
  big: animSign([
    { right: FINGERSPELLING.L, left: FINGERSPELLING.L, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.L, wristY: -0.4 }, left: { ...FINGERSPELLING.L, wristY: 0.4 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  small: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristY: 0.3 }, left: { ...FLAT_B, wristY: -0.3 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  same: animSign([
    { right: Y_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...Y_SHAPE, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  different: animSign([
    { right: POINT_UP, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: -0.4 }, left: { ...POINT_UP, wristZ: 0.4 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  new: animSign([
    { right: CURVED, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...CURVED, wristX: 0.2 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  old: animSign([
    { right: CURVED, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FIST, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),

  // Colors
  red: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristX: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  blue: animSign([
    { right: FINGERSPELLING.B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.B, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  green: animSign([
    { right: FINGERSPELLING.G, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.G, wristZ: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  yellow: animSign([
    { right: Y_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...Y_SHAPE, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  white: animSign([
    { right: CURVED, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  black: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: -0.4 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),

  // Numbers
  one: staticSign({ ...POINT_UP, thumb: { flex: 0.7, abd: 0 } }, FIST),
  two: staticSign(V_SHAPE, FIST),
  three: staticSign({ thumb: { flex: 0.1, abd: 0.7 }, index: { curl: 0, spread: -0.2 }, middle: { curl: 0, spread: 0.2 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, FIST),
  four: staticSign({ thumb: { flex: 0.8, abd: 0 }, index: { curl: 0, spread: -0.3 }, middle: { curl: 0, spread: -0.1 }, ring: { curl: 0, spread: 0.1 }, pinky: { curl: 0, spread: 0.3 } }, FIST),
  five: staticSign(OPEN, FIST),
  six: staticSign({ thumb: { flex: 0, abd: 0.7 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0, spread: 0 } }, FIST),
  seven: staticSign({ thumb: { flex: 0.2, abd: 0.5 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, FIST),
  eight: staticSign({ thumb: { flex: 0.2, abd: 0.5 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, FIST),
  nine: staticSign(O_SHAPE, FIST),
  ten: staticSign({ ...FINGERSPELLING.A, wristZ: 0.2 }, FIST),

  // Animals
  dog: staticSign({ ...FLAT_B, thumb: { flex: 0.3, abd: 0.8 } }, FIST),
  cat: animSign([
    { right: FINGERSPELLING.F, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.F, wristY: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  bird: animSign([
    { right: FINGERSPELLING.G, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.G, wristX: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),

  // Misc
  'i love you': staticSign(Y_SHAPE, FIST, { ...HAPPY_FACE, mouthSmile: 0.9 }, 1000),
};

// ============================================================
// Lookup functions
// ============================================================

export function lookupSign(word: string): WordSign | null {
  const normalized = word.toLowerCase().replace(/[^a-z\s]/g, '').trim();
  return WORD_SIGNS[normalized] ?? null;
}

export function letterToPose(letter: string): HandPose | null {
  const upper = letter.toUpperCase();
  return FINGERSPELLING[upper] ?? null;
}

export function wordToSignQueue(word: string): Array<{ right: HandPose; left: HandPose; face: FaceExpression; holdMs: number }> {
  const sign = lookupSign(word);
  if (sign) {
    return sign.frames.map(f => ({
      right: f.right,
      left: f.left,
      face: f.face ?? NEUTRAL_FACE,
      holdMs: f.holdMs,
    }));
  }
  // Fingerspell the word
  const letters = word.replace(/[^a-zA-Z]/g, '').toUpperCase().split('');
  return letters.map(letter => {
    const pose = FINGERSPELLING[letter] ?? FIST;
    return { right: pose, left: FIST, face: NEUTRAL_FACE, holdMs: 400 };
  });
}
