// ============================================================
// ASL Pose Library – Production-quality sign data
// Covers 400+ English words with accurate ASL handshapes.
// Words not in the dictionary fall back to fingerspelling.
// ============================================================

export interface FingerState {
  curl:   number;   // 0 = straight, 1 = fully curled
  spread: number;   // -1 = spread apart, 0 = neutral, 1 = adducted
}

export interface ThumbState {
  flex: number;   // 0 = open/extended, 1 = curled into palm
  abd:  number;   // 0 = folded in, 1 = fully abducted out
}

export interface HandPose {
  thumb:  ThumbState;
  index:  FingerState;
  middle: FingerState;
  ring:   FingerState;
  pinky:  FingerState;
  wristX?: number;   // palm tilt (flex/extend)
  wristY?: number;   // pronation / supination
  wristZ?: number;   // radial / ulnar deviation (roll)
  posX?:  number;    // world-X offset from rest (metres; +ve = toward viewer's right)
  posY?:  number;    // world-Y offset from rest (metres; +ve = upward)
  posZ?:  number;    // world-Z offset from rest (metres; +ve = toward camera)
}

// ─── Signing-area position offsets (posY from hand rest at world y ≈ -0.08) ─────
// Face centre is at world y = +0.50. Offsets below bring the dominant hand
// to each facial / body area. Computed from the face geometry in SignAvatar.tsx.
const AT_JAW      = 0.40;   // lower jaw / chin base (world y ≈ +0.32)
const AT_CHIN     = 0.44;   // chin tip              (world y ≈ +0.36)
const AT_MOUTH    = 0.51;   // lips                  (world y ≈ +0.43)
const AT_CHEEK    = 0.46;   // cheekbone             (world y ≈ +0.38)
const AT_NOSE     = 0.54;   // nose tip              (world y ≈ +0.46)
const AT_EYE      = 0.62;   // eye level             (world y ≈ +0.54)
const AT_TEMPLE   = 0.64;   // temple / side-head    (world y ≈ +0.56)
const AT_FOREHEAD = 0.68;   // forehead              (world y ≈ +0.60)
const AT_CHEST    = 0.12;   // upper chest           (world y ≈ +0.04)
// Helper: spread position fields onto any HandPose
const atPos = (pose: HandPose, y: number, z = 0.04, x = 0): HandPose =>
  ({ ...pose, posX: x, posY: y, posZ: z });

export interface FaceExpression {
  eyebrowRaise: number;   // -1 furrowed → 0 neutral → 1 raised
  mouthOpen:    number;   // 0 closed → 1 wide open
  mouthSmile:   number;   // -1 frown → 0 neutral → 1 smile
  headTiltX?:   number;   // pitch
  headTiltY?:   number;   // yaw
  cheekPuff?:   number;   // 0 normal → 1 puffed
  eyeSquint?:   number;   // 0 open → 1 squinted/closed
}

export interface SignKeyframe {
  right: HandPose;
  left:  HandPose;
  face?: FaceExpression;
  holdMs: number;
}

export interface WordSign {
  frames: SignKeyframe[];
}

// ============================================================
// Named Handshapes (standard ASL classifier handshapes)
// ============================================================

// Open flat hand – palm forward (B-hand extended)
export const OPEN: HandPose = {
  thumb:  { flex: 0, abd: 0.6 },
  index:  { curl: 0, spread: 0 },
  middle: { curl: 0, spread: 0 },
  ring:   { curl: 0, spread: 0 },
  pinky:  { curl: 0, spread: 0 },
};

// Closed fist (A or S handshape)
export const FIST: HandPose = {
  thumb:  { flex: 0.8, abd: 0.1 },
  index:  { curl: 1,   spread: 0 },
  middle: { curl: 1,   spread: 0 },
  ring:   { curl: 1,   spread: 0 },
  pinky:  { curl: 1,   spread: 0 },
};

// Flat B – fingers together, thumb tucked
const FLAT_B: HandPose = {
  thumb:  { flex: 0.8, abd: 0 },
  index:  { curl: 0, spread: 0 },
  middle: { curl: 0, spread: 0 },
  ring:   { curl: 0, spread: 0 },
  pinky:  { curl: 0, spread: 0 },
};

// Open 5 – all fingers spread
const OPEN5: HandPose = {
  thumb:  { flex: 0, abd: 1 },
  index:  { curl: 0, spread: -0.6 },
  middle: { curl: 0, spread: -0.2 },
  ring:   { curl: 0, spread: 0.2 },
  pinky:  { curl: 0, spread: 0.6 },
};

// Curved (C-like open hand)
const CURVED: HandPose = {
  thumb:  { flex: 0.3, abd: 0.6 },
  index:  { curl: 0.3, spread: -0.1 },
  middle: { curl: 0.3, spread:  0 },
  ring:   { curl: 0.3, spread:  0 },
  pinky:  { curl: 0.3, spread:  0 },
};

// O shape (all fingertips meet thumb tip)
const O_SHAPE: HandPose = {
  thumb:  { flex: 0.55, abd: 0.4 },
  index:  { curl: 0.62, spread: 0 },
  middle: { curl: 0.62, spread: 0 },
  ring:   { curl: 0.60, spread: 0 },
  pinky:  { curl: 0.58, spread: 0 },
};

// Flat O (fingers bent at second knuckle, tips to thumb)
const FLAT_O: HandPose = {
  thumb:  { flex: 0.45, abd: 0.3 },
  index:  { curl: 0.55, spread: 0 },
  middle: { curl: 0.55, spread: 0 },
  ring:   { curl: 0.50, spread: 0 },
  pinky:  { curl: 0.48, spread: 0 },
};

// Y handshape (thumb + pinky extended)
const Y_SHAPE: HandPose = {
  thumb:  { flex: 0,   abd: 1 },
  index:  { curl: 0.9, spread: 0 },
  middle: { curl: 0.9, spread: 0 },
  ring:   { curl: 0.9, spread: 0 },
  pinky:  { curl: 0,   spread: 0 },
};

// V / Peace sign (index + middle extended spread)
const V_SHAPE: HandPose = {
  thumb:  { flex: 0.7, abd: 0 },
  index:  { curl: 0,   spread: -0.35 },
  middle: { curl: 0,   spread:  0.35 },
  ring:   { curl: 0.9, spread:  0 },
  pinky:  { curl: 0.9, spread:  0 },
};

// U handshape (index + middle together, pointing up)
const U_SHAPE: HandPose = {
  thumb:  { flex: 0.7, abd: 0 },
  index:  { curl: 0,   spread:  0.05 },
  middle: { curl: 0,   spread: -0.05 },
  ring:   { curl: 0.9, spread:  0 },
  pinky:  { curl: 0.9, spread:  0 },
};

// D handshape (index pointing up, others curve to thumb)
const D_SHAPE: HandPose = {
  thumb:  { flex: 0.5, abd: 0.35 },
  index:  { curl: 0,   spread: 0 },
  middle: { curl: 0.8, spread: 0 },
  ring:   { curl: 0.8, spread: 0 },
  pinky:  { curl: 0.8, spread: 0 },
};

// G handshape (index sideways, thumb parallel)
const G_SHAPE: HandPose = {
  thumb:  { flex: 0.1, abd: 0.7 },
  index:  { curl: 0,   spread: 0 },
  middle: { curl: 0.9, spread: 0 },
  ring:   { curl: 0.9, spread: 0 },
  pinky:  { curl: 0.9, spread: 0 },
  wristY: -0.5,
};

// H handshape (index + middle sideways, like pointing sideways)
const H_SHAPE: HandPose = {
  thumb:  { flex: 0.7, abd: 0 },
  index:  { curl: 0,   spread: 0.05 },
  middle: { curl: 0,   spread:-0.05 },
  ring:   { curl: 0.9, spread: 0 },
  pinky:  { curl: 0.9, spread: 0 },
  wristY: -0.5,
};

// L handshape (index up, thumb out)
const L_SHAPE: HandPose = {
  thumb:  { flex: 0,   abd: 1 },
  index:  { curl: 0,   spread: 0 },
  middle: { curl: 0.9, spread: 0 },
  ring:   { curl: 0.9, spread: 0 },
  pinky:  { curl: 0.9, spread: 0 },
};

// F handshape (index-thumb circle, others up)
const F_SHAPE: HandPose = {
  thumb:  { flex: 0.4, abd: 0.55 },
  index:  { curl: 0.65, spread: 0 },
  middle: { curl: 0,   spread: 0 },
  ring:   { curl: 0,   spread: 0 },
  pinky:  { curl: 0,   spread: 0 },
};

// K handshape (index up, middle angled, thumb between)
const K_SHAPE: HandPose = {
  thumb:  { flex: 0.25, abd: 0.5 },
  index:  { curl: 0,    spread: 0 },
  middle: { curl: 0.15, spread:-0.3 },
  ring:   { curl: 0.9,  spread: 0 },
  pinky:  { curl: 0.9,  spread: 0 },
};

// W handshape (3 fingers up spread)
const W_SHAPE: HandPose = {
  thumb:  { flex: 0.7, abd: 0 },
  index:  { curl: 0,   spread:-0.4 },
  middle: { curl: 0,   spread: 0 },
  ring:   { curl: 0,   spread: 0.4 },
  pinky:  { curl: 0.9, spread: 0 },
};

// X handshape (index hooked/bent)
const X_SHAPE: HandPose = {
  thumb:  { flex: 0.6, abd: 0.3 },
  index:  { curl: 0.45, spread: 0 },
  middle: { curl: 0.9,  spread: 0 },
  ring:   { curl: 0.9,  spread: 0 },
  pinky:  { curl: 0.9,  spread: 0 },
};

// Index pointing up (1 / point)
const POINT_UP: HandPose = {
  thumb:  { flex: 0.65, abd: 0.15 },
  index:  { curl: 0,    spread: 0 },
  middle: { curl: 0.9,  spread: 0 },
  ring:   { curl: 0.9,  spread: 0 },
  pinky:  { curl: 0.9,  spread: 0 },
};

// A handshape (fist with thumb at side)
const A_SHAPE: HandPose = {
  thumb:  { flex: 0.3, abd: 0.35 },
  index:  { curl: 0.95, spread: 0 },
  middle: { curl: 0.95, spread: 0 },
  ring:   { curl: 0.95, spread: 0 },
  pinky:  { curl: 0.95, spread: 0 },
};

// S handshape (fist with thumb over fingers)
const S_SHAPE: HandPose = {
  thumb:  { flex: 0.75, abd: 0.1 },
  index:  { curl: 1,    spread: 0 },
  middle: { curl: 1,    spread: 0 },
  ring:   { curl: 1,    spread: 0 },
  pinky:  { curl: 1,    spread: 0 },
};

// E handshape (fingers bent at mid-knuckle, touching thumb)
const E_SHAPE: HandPose = {
  thumb:  { flex: 0.9, abd: 0 },
  index:  { curl: 0.6, spread: 0 },
  middle: { curl: 0.6, spread: 0 },
  ring:   { curl: 0.6, spread: 0 },
  pinky:  { curl: 0.6, spread: 0 },
};

// M handshape (3 fingers over thumb)
const M_SHAPE: HandPose = {
  thumb:  { flex: 0.85, abd: 0 },
  index:  { curl: 0.7,  spread: 0 },
  middle: { curl: 0.7,  spread: 0 },
  ring:   { curl: 0.7,  spread: 0 },
  pinky:  { curl: 0.85, spread: 0 },
};

// N handshape (2 fingers over thumb)
const N_SHAPE: HandPose = {
  thumb:  { flex: 0.85, abd: 0 },
  index:  { curl: 0.7,  spread: 0 },
  middle: { curl: 0.7,  spread: 0 },
  ring:   { curl: 0.88, spread: 0 },
  pinky:  { curl: 0.88, spread: 0 },
};

// R handshape (index + middle crossed)
const R_SHAPE: HandPose = {
  thumb:  { flex: 0.7, abd: 0 },
  index:  { curl: 0,   spread:  0.2 },
  middle: { curl: 0,   spread: -0.2 },
  ring:   { curl: 0.9, spread:  0 },
  pinky:  { curl: 0.9, spread:  0 },
};

// T handshape (thumb between index and middle)
const T_SHAPE: HandPose = {
  thumb:  { flex: 0.55, abd: 0.25 },
  index:  { curl: 0.82, spread: 0 },
  middle: { curl: 0.9,  spread: 0 },
  ring:   { curl: 0.9,  spread: 0 },
  pinky:  { curl: 0.9,  spread: 0 },
};

// ILY (I Love You) – thumb + index + pinky
const ILY: HandPose = {
  thumb:  { flex: 0,   abd: 1 },
  index:  { curl: 0,   spread: -0.2 },
  middle: { curl: 0.9, spread: 0 },
  ring:   { curl: 0.9, spread: 0 },
  pinky:  { curl: 0,   spread: 0.2 },
};

// Claw (bent all fingers, spread)
const CLAW: HandPose = {
  thumb:  { flex: 0.4, abd: 0.7 },
  index:  { curl: 0.5, spread: -0.4 },
  middle: { curl: 0.5, spread: -0.1 },
  ring:   { curl: 0.5, spread:  0.1 },
  pinky:  { curl: 0.5, spread:  0.4 },
};

// ============================================================
// Named Face Expressions
// ============================================================

export const NEUTRAL_FACE: FaceExpression = {
  eyebrowRaise: 0, mouthOpen: 0, mouthSmile: 0.1,
  headTiltX: 0, headTiltY: 0, cheekPuff: 0, eyeSquint: 0,
};

export const QUESTION_FACE: FaceExpression = {
  eyebrowRaise: 0.85, mouthOpen: 0.15, mouthSmile: 0,
  headTiltX: 0, headTiltY: 0.28, cheekPuff: 0, eyeSquint: 0,
};

export const WH_QUESTION_FACE: FaceExpression = {
  eyebrowRaise: -0.4, mouthOpen: 0.1, mouthSmile: 0,
  headTiltX: 0.05, headTiltY: 0.15, cheekPuff: 0, eyeSquint: 0.2,
};

export const HAPPY_FACE: FaceExpression = {
  eyebrowRaise: 0.35, mouthOpen: 0.3, mouthSmile: 0.9,
  headTiltX: 0, headTiltY: 0, cheekPuff: 0, eyeSquint: 0.45,
};

export const SAD_FACE: FaceExpression = {
  eyebrowRaise: -0.5, mouthOpen: 0.08, mouthSmile: -0.75,
  headTiltX: 0.12, headTiltY: 0, cheekPuff: 0, eyeSquint: 0,
};

export const ANGRY_FACE: FaceExpression = {
  eyebrowRaise: -0.75, mouthOpen: 0.25, mouthSmile: -0.5,
  headTiltX: 0, headTiltY: 0, cheekPuff: 0, eyeSquint: 0.55,
};

export const SURPRISED_FACE: FaceExpression = {
  eyebrowRaise: 1, mouthOpen: 0.7, mouthSmile: 0,
  headTiltX: -0.08, headTiltY: 0, cheekPuff: 0, eyeSquint: 0,
};

export const DISGUSTED_FACE: FaceExpression = {
  eyebrowRaise: -0.3, mouthOpen: 0.15, mouthSmile: -0.3,
  headTiltX: 0, headTiltY: 0, cheekPuff: 0.4, eyeSquint: 0.2,
};

export const INTENSE_FACE: FaceExpression = {
  eyebrowRaise: -0.2, mouthOpen: 0, mouthSmile: 0,
  headTiltX: 0, headTiltY: 0, cheekPuff: 0, eyeSquint: 0.3,
};

// ============================================================
// Helper functions
// ============================================================
function staticSign(right: HandPose, left: HandPose, face?: FaceExpression, holdMs = 620): WordSign {
  return { frames: [{ right, left, face: face ?? NEUTRAL_FACE, holdMs }] };
}

function animSign(frames: SignKeyframe[]): WordSign {
  return { frames };
}

// Two-frame sign: hold shape A → move/morph to shape B
function twoFrame(
  r1: HandPose, l1: HandPose,
  r2: HandPose, l2: HandPose,
  face?: FaceExpression, t1 = 280, t2 = 400,
): WordSign {
  const f = face ?? NEUTRAL_FACE;
  return { frames: [{ right: r1, left: l1, face: f, holdMs: t1 }, { right: r2, left: l2, face: f, holdMs: t2 }] };
}

// Repeated motion (two frames swapped 2x = natural repeated sign)
function repeated(
  r1: HandPose, l1: HandPose,
  r2: HandPose, l2: HandPose,
  face?: FaceExpression, each = 240,
): WordSign {
  const f = face ?? NEUTRAL_FACE;
  return { frames: [
    { right: r1, left: l1, face: f, holdMs: each },
    { right: r2, left: l2, face: f, holdMs: each },
    { right: r1, left: l1, face: f, holdMs: each },
  ]};
}

// ============================================================
// Fingerspelling A–Z
// ============================================================
export const FINGERSPELLING: Record<string, HandPose> = {
  A: { thumb: { flex: 0.3,  abd: 0.35 }, index: { curl: 0.95, spread: 0 }, middle: { curl: 0.95, spread: 0 }, ring: { curl: 0.95, spread: 0 }, pinky: { curl: 0.95, spread: 0 } },
  B: { thumb: { flex: 0.8,  abd: 0 },    index: { curl: 0,    spread: 0 }, middle: { curl: 0,    spread: 0 }, ring: { curl: 0,    spread: 0 }, pinky: { curl: 0,    spread: 0 } },
  C: { thumb: { flex: 0.4,  abd: 0.5 },  index: { curl: 0.45, spread: 0 }, middle: { curl: 0.45, spread: 0 }, ring: { curl: 0.45, spread: 0 }, pinky: { curl: 0.45, spread: 0 } },
  D: { thumb: { flex: 0.45, abd: 0.35 }, index: { curl: 0,    spread: 0 }, middle: { curl: 0.82, spread: 0 }, ring: { curl: 0.82, spread: 0 }, pinky: { curl: 0.82, spread: 0 } },
  E: { thumb: { flex: 0.9,  abd: 0 },    index: { curl: 0.6,  spread: 0 }, middle: { curl: 0.6,  spread: 0 }, ring: { curl: 0.6,  spread: 0 }, pinky: { curl: 0.6,  spread: 0 } },
  F: { thumb: { flex: 0.35, abd: 0.55 }, index: { curl: 0.68, spread: 0 }, middle: { curl: 0,    spread: 0 }, ring: { curl: 0,    spread: 0 }, pinky: { curl: 0,    spread: 0 } },
  G: { thumb: { flex: 0.05, abd: 0.7 },  index: { curl: 0,    spread: 0 }, middle: { curl: 0.9,  spread: 0 }, ring: { curl: 0.9,  spread: 0 }, pinky: { curl: 0.9,  spread: 0 }, wristY: -0.5 },
  H: { thumb: { flex: 0.7,  abd: 0 },    index: { curl: 0,    spread: 0.05 }, middle: { curl: 0, spread:-0.05 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 }, wristY: -0.5 },
  I: { thumb: { flex: 0.62, abd: 0.2 },  index: { curl: 0.9,  spread: 0 }, middle: { curl: 0.9,  spread: 0 }, ring: { curl: 0.9,  spread: 0 }, pinky: { curl: 0,    spread: 0 } },
  J: { thumb: { flex: 0.62, abd: 0.2 },  index: { curl: 0.9,  spread: 0 }, middle: { curl: 0.9,  spread: 0 }, ring: { curl: 0.9,  spread: 0 }, pinky: { curl: 0,    spread: 0 } },
  K: { thumb: { flex: 0.22, abd: 0.5 },  index: { curl: 0,    spread: 0 }, middle: { curl: 0.15, spread:-0.3 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  L: { thumb: { flex: 0,    abd: 1 },    index: { curl: 0,    spread: 0 }, middle: { curl: 0.9,  spread: 0 }, ring: { curl: 0.9,  spread: 0 }, pinky: { curl: 0.9,  spread: 0 } },
  M: { thumb: { flex: 0.85, abd: 0 },    index: { curl: 0.7,  spread: 0 }, middle: { curl: 0.7,  spread: 0 }, ring: { curl: 0.7,  spread: 0 }, pinky: { curl: 0.85, spread: 0 } },
  N: { thumb: { flex: 0.85, abd: 0 },    index: { curl: 0.7,  spread: 0 }, middle: { curl: 0.7,  spread: 0 }, ring: { curl: 0.88, spread: 0 }, pinky: { curl: 0.88, spread: 0 } },
  O: { thumb: { flex: 0.5,  abd: 0.42 }, index: { curl: 0.62, spread: 0 }, middle: { curl: 0.62, spread: 0 }, ring: { curl: 0.60, spread: 0 }, pinky: { curl: 0.58, spread: 0 } },
  P: { thumb: { flex: 0.22, abd: 0.5 },  index: { curl: 0,    spread: 0 }, middle: { curl: 0.15, spread:-0.3 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 }, wristX: 0.4 },
  Q: { thumb: { flex: 0.05, abd: 0.65 }, index: { curl: 0,    spread: 0 }, middle: { curl: 0.9,  spread: 0 }, ring: { curl: 0.9,  spread: 0 }, pinky: { curl: 0.9,  spread: 0 }, wristX: 0.4 },
  R: { thumb: { flex: 0.7,  abd: 0 },    index: { curl: 0,    spread: 0.2 }, middle: { curl: 0, spread:-0.2 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  S: { thumb: { flex: 0.75, abd: 0.1 },  index: { curl: 1,    spread: 0 }, middle: { curl: 1,    spread: 0 }, ring: { curl: 1,    spread: 0 }, pinky: { curl: 1,    spread: 0 } },
  T: { thumb: { flex: 0.55, abd: 0.25 }, index: { curl: 0.82, spread: 0 }, middle: { curl: 0.9,  spread: 0 }, ring: { curl: 0.9,  spread: 0 }, pinky: { curl: 0.9,  spread: 0 } },
  U: { thumb: { flex: 0.72, abd: 0 },    index: { curl: 0,    spread: 0.05 }, middle: { curl: 0, spread:-0.05 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  V: { thumb: { flex: 0.72, abd: 0 },    index: { curl: 0,    spread:-0.32 }, middle: { curl: 0, spread: 0.32 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
  W: { thumb: { flex: 0.72, abd: 0 },    index: { curl: 0,    spread:-0.4 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0, spread: 0.4 }, pinky: { curl: 0.9, spread: 0 } },
  X: { thumb: { flex: 0.62, abd: 0.3 },  index: { curl: 0.48, spread: 0 }, middle: { curl: 0.9,  spread: 0 }, ring: { curl: 0.9,  spread: 0 }, pinky: { curl: 0.9,  spread: 0 } },
  Y: { thumb: { flex: 0,    abd: 1 },    index: { curl: 0.9,  spread: 0 }, middle: { curl: 0.9,  spread: 0 }, ring: { curl: 0.9,  spread: 0 }, pinky: { curl: 0,    spread: 0 } },
  Z: { thumb: { flex: 0.72, abd: 0 },    index: { curl: 0,    spread: 0 }, middle: { curl: 0.9,  spread: 0 }, ring: { curl: 0.9,  spread: 0 }, pinky: { curl: 0.9,  spread: 0 } },
};

// C handshape (curved C opening)
const C_SHAPE: HandPose = {
  thumb:  { flex: 0.4, abd: 0.52 },
  index:  { curl: 0.45, spread: 0 },
  middle: { curl: 0.45, spread: 0 },
  ring:   { curl: 0.45, spread: 0 },
  pinky:  { curl: 0.45, spread: 0 },
};

// I handshape (pinky extended)
const I_SHAPE: HandPose = {
  thumb:  { flex: 0.62, abd: 0.2 },
  index:  { curl: 0.9, spread: 0 },
  middle: { curl: 0.9, spread: 0 },
  ring:   { curl: 0.9, spread: 0 },
  pinky:  { curl: 0,   spread: 0 },
};

// "Open 8" / FEEL handshape: middle finger bent, others relaxed
const FEEL_HP: HandPose = {
  thumb:  { flex: 0.1, abd: 0.4 },
  index:  { curl: 0,   spread: -0.1 },
  middle: { curl: 0.65, spread: 0 },
  ring:   { curl: 0,   spread: 0.1 },
  pinky:  { curl: 0,   spread: 0.2 },
};

// ============================================================
// Word Sign Dictionary  (550+ entries)
// ============================================================
export const WORD_SIGNS: Record<string, WordSign> = {

  // ── Greetings & Farewells ──────────────────────────────────
  // HELLO: B-hand salute — flat hand at temple, sweeps outward like a salute
  hello: animSign([
    { right: atPos(FLAT_B, AT_TEMPLE, 0.01, +0.06), left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...atPos(FLAT_B, AT_TEMPLE - 0.05, 0.07), wristZ: 0.28 }, left: FIST, face: HAPPY_FACE, holdMs: 500 },
  ]),
  hi: animSign([
    { right: atPos(FLAT_B, AT_TEMPLE, 0.01, +0.06), left: FIST, face: HAPPY_FACE, holdMs: 320 },
    { right: { ...atPos(FLAT_B, AT_TEMPLE - 0.04, 0.06), wristZ: 0.32 }, left: FIST, face: HAPPY_FACE, holdMs: 380 },
  ]),
  goodbye: animSign([
    { right: OPEN, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...OPEN, wristX: 0.25 }, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: OPEN, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...OPEN, wristX: 0.25 }, left: FIST, face: HAPPY_FACE, holdMs: 300 },
  ]),
  bye: animSign([
    { right: OPEN, left: FIST, face: HAPPY_FACE, holdMs: 340 },
    { right: { ...OPEN, wristX: 0.28 }, left: FIST, face: HAPPY_FACE, holdMs: 460 },
  ]),
  welcome: animSign([
    { right: OPEN, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...OPEN, wristZ: 0.4 }, left: FIST, face: HAPPY_FACE, holdMs: 500 },
  ]),
  // PLEASE: flat B hand on chest, circular rubbing motion
  please: animSign([
    { right: atPos(FLAT_B, AT_CHEST, 0.07), left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.45 }, holdMs: 280 },
    { right: { ...atPos(FLAT_B, AT_CHEST, 0.07), wristZ: 0.30 }, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.45 }, holdMs: 280 },
    { right: atPos(FLAT_B, AT_CHEST, 0.07), left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.45 }, holdMs: 240 },
  ]),
  // SORRY: A-hand (fist) circular motion on chest
  sorry: animSign([
    { right: atPos(A_SHAPE, AT_CHEST, 0.07), left: FIST, face: SAD_FACE, holdMs: 280 },
    { right: { ...atPos(A_SHAPE, AT_CHEST, 0.07), wristZ: 0.28 }, left: FIST, face: SAD_FACE, holdMs: 280 },
    { right: atPos(A_SHAPE, AT_CHEST, 0.07), left: FIST, face: SAD_FACE, holdMs: 240 },
  ]),
  'excuse me': animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.3 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  // THANK YOU: B-hand from chin sweeps forward — fingertips start at chin, arc forward
  'thank you': animSign([
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.07, 0.13), wristX: 0.28 }, left: FIST, face: HAPPY_FACE, holdMs: 520 },
  ]),
  thanks: animSign([
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.07, 0.13), wristX: 0.28 }, left: FIST, face: HAPPY_FACE, holdMs: 520 },
  ]),
  "you're welcome": animSign([
    { right: OPEN, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...OPEN, wristZ: 0.4 }, left: FIST, face: HAPPY_FACE, holdMs: 500 },
  ]),
  'nice to meet you': animSign([
    { right: FLAT_B, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.3 }, left: FIST, face: HAPPY_FACE, holdMs: 300 },
    { right: POINT_UP, left: FIST, face: HAPPY_FACE, holdMs: 400 },
  ]),
  'how are you': animSign([
    { right: CURVED, left: CURVED, face: QUESTION_FACE, holdMs: 300 },
    { right: FLAT_B, left: FLAT_B, face: QUESTION_FACE, holdMs: 300 },
    { right: POINT_UP, left: FIST, face: QUESTION_FACE, holdMs: 400 },
  ]),
  congratulations: animSign([
    { right: FLAT_B, left: FLAT_B, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: 0.3 }, left: { ...FLAT_B, wristZ: -0.3 }, face: HAPPY_FACE, holdMs: 280 },
    { right: FLAT_B, left: FLAT_B, face: HAPPY_FACE, holdMs: 280 },
  ]),

  // ── Pronouns ──────────────────────────────────────────────
  i:    staticSign(POINT_UP, FIST),
  me:   staticSign(POINT_UP, FIST),
  you:  staticSign({ ...POINT_UP, wristZ: 0.18 }, FIST),
  we:   twoFrame(POINT_UP, FIST, { ...POINT_UP, wristY: 0.42 }, FIST),
  us:   twoFrame(POINT_UP, FIST, { ...POINT_UP, wristY: 0.42 }, FIST),
  they: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristY: -0.38 }, FIST),
  them: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristY: -0.38 }, FIST),
  he:   staticSign(POINT_UP, FIST),
  she:  staticSign(POINT_UP, FIST),
  it:   staticSign(POINT_UP, FIST),
  my:   staticSign(FLAT_B,   FIST),
  your: staticSign({ ...FLAT_B, wristZ: 0.2 }, FIST, NEUTRAL_FACE),
  his:  staticSign(FLAT_B, FIST),
  her:  staticSign(FLAT_B, FIST),
  our:  twoFrame(FLAT_B, FIST, { ...FLAT_B, wristY: 0.4 }, FIST),
  their: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristY: -0.35 }, FIST),
  mine: staticSign(FLAT_B, FIST),
  yours: staticSign({ ...FLAT_B, wristZ: 0.2 }, FIST),
  himself: staticSign(A_SHAPE, FIST),
  herself: staticSign(A_SHAPE, FIST),
  myself:  staticSign(A_SHAPE, FIST),
  yourself: staticSign({ ...A_SHAPE, wristZ: 0.2 }, FIST),
  themselves: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristY: -0.3 }, FIST),

  // ── Yes / No / Agreement ─────────────────────────────────
  yes: repeated(FIST, FIST, { ...FIST, wristX: 0.32 }, FIST),
  no: animSign([
    { right: FINGERSPELLING.N, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FINGERSPELLING.O, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  okay: animSign([
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 300 },
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 380 },
  ]),
  wrong: animSign([
    { right: Y_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...Y_SHAPE, wristX: -0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  correct: animSign([
    { right: POINT_UP, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristX: 0.2 }, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  true: staticSign(POINT_UP, FIST, { ...NEUTRAL_FACE, mouthSmile: 0.2 }),
  false: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: -0.4 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  sure: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristX: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  maybe: animSign([
    { right: OPEN, left: OPEN, face: QUESTION_FACE, holdMs: 280 },
    { right: { ...OPEN, wristX: 0.25 }, left: { ...OPEN, wristX: -0.25 }, face: QUESTION_FACE, holdMs: 280 },
    { right: OPEN, left: OPEN, face: QUESTION_FACE, holdMs: 280 },
  ]),
  probably: animSign([
    { right: OPEN, left: OPEN, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...OPEN, wristX: 0.25 }, left: { ...OPEN, wristX: -0.25 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  possible: animSign([
    { right: FIST, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FIST, wristX: 0.25 }, left: { ...FIST, wristX: 0.25 }, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  impossible: animSign([
    { right: FIST, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.3 }, holdMs: 280 },
    { right: { ...FIST, wristX: -0.25 }, left: { ...FIST, wristX: 0.25 }, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.3 }, holdMs: 400 },
  ]),

  // ── Questions ─────────────────────────────────────────────
  what: animSign([
    { right: FLAT_B, left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.2 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 420 },
  ]),
  where: animSign([
    { right: POINT_UP, left: FIST, face: WH_QUESTION_FACE, holdMs: 260 },
    { right: { ...POINT_UP, wristZ: 0.3 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 260 },
    { right: { ...POINT_UP, wristZ: -0.3 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 260 },
  ]),
  when: staticSign(POINT_UP, POINT_UP, WH_QUESTION_FACE),
  // WHO: D-hand circles near chin / lower face area
  who: animSign([
    { right: atPos(D_SHAPE, AT_CHIN, 0.04, +0.02), left: FIST, face: WH_QUESTION_FACE, holdMs: 300 },
    { right: { ...atPos(D_SHAPE, AT_CHIN, 0.04, +0.02), wristZ: 0.22 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: atPos(D_SHAPE, AT_CHIN, 0.04, +0.02), left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
  ]),
  // WHY: hand at temple, fingers fold to Y-shape as hand moves outward
  why: animSign([
    { right: atPos(FLAT_B, AT_TEMPLE, 0.01, +0.05), left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...atPos(Y_SHAPE, AT_TEMPLE - 0.02, 0.06), }, left: FIST, face: WH_QUESTION_FACE, holdMs: 420 },
  ]),
  how: animSign([
    { right: CURVED, left: CURVED, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: FLAT_B, left: FLAT_B, face: WH_QUESTION_FACE, holdMs: 420 },
  ]),
  which: animSign([
    { right: A_SHAPE, left: A_SHAPE, face: QUESTION_FACE, holdMs: 280 },
    { right: { ...A_SHAPE, wristX: 0.25 }, left: { ...A_SHAPE, wristX: -0.25 }, face: QUESTION_FACE, holdMs: 280 },
    { right: A_SHAPE, left: A_SHAPE, face: QUESTION_FACE, holdMs: 280 },
  ]),
  'how much': animSign([
    { right: CURVED, left: CURVED, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: OPEN5,  left: OPEN5,  face: WH_QUESTION_FACE, holdMs: 420 },
  ]),
  'how many': animSign([
    { right: CURVED, left: CURVED, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: OPEN5,  left: FIST,   face: WH_QUESTION_FACE, holdMs: 420 },
  ]),

  // ── Emotions & Feelings ──────────────────────────────────
  // HAPPY: B-hand brushes upward on chest twice (circular chest motion)
  happy: animSign([
    { right: atPos(FLAT_B, AT_CHEST, 0.07), left: FIST, face: HAPPY_FACE, holdMs: 260 },
    { right: { ...atPos(FLAT_B, AT_CHEST + 0.04, 0.07), wristX: 0.20 }, left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: atPos(FLAT_B, AT_CHEST, 0.07), left: FIST, face: HAPPY_FACE, holdMs: 260 },
  ]),
  sad: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: -0.28 }, { ...FLAT_B, wristX: -0.28 }, SAD_FACE),
  // LOVE: both arms crossed over chest — right arm crosses over left
  love: staticSign(
    { ...A_SHAPE, posX: +0.14, posY: AT_CHEST + 0.02, posZ: 0.09 },
    { ...A_SHAPE, posX: -0.14, posY: AT_CHEST + 0.02, posZ: 0.09 },
    { ...HAPPY_FACE, mouthSmile: 0.95 }, 750),
  angry: twoFrame(CLAW, FIST, FIST, FIST, ANGRY_FACE),
  // GOOD: B-hand from chin forward — start at chin, arc forward and down
  good: animSign([
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.06, 0.12), wristX: 0.22 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 440 },
  ]),
  bad: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: -0.42 }, FIST, SAD_FACE),
  great: twoFrame(OPEN, FIST, { ...OPEN, wristX: 0.2 }, FIST, HAPPY_FACE),
  wonderful: animSign([
    { right: OPEN5, left: OPEN5, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...OPEN5, wristX: 0.2 }, left: { ...OPEN5, wristX: 0.2 }, face: HAPPY_FACE, holdMs: 280 },
    { right: OPEN5, left: OPEN5, face: HAPPY_FACE, holdMs: 280 },
  ]),
  beautiful: twoFrame(O_SHAPE, FIST, OPEN5, FIST, HAPPY_FACE),
  pretty: twoFrame(O_SHAPE, FIST, OPEN5, FIST, HAPPY_FACE),
  ugly: twoFrame(X_SHAPE, FIST, { ...X_SHAPE, wristZ: -0.3 }, FIST, DISGUSTED_FACE),
  fun: twoFrame(U_SHAPE, U_SHAPE, { ...U_SHAPE, wristX: 0.2 }, U_SHAPE, HAPPY_FACE),
  funny: twoFrame(U_SHAPE, U_SHAPE, { ...U_SHAPE, wristX: 0.2 }, U_SHAPE, HAPPY_FACE),
  excited: animSign([
    { right: OPEN5, left: OPEN5, face: HAPPY_FACE, holdMs: 240 },
    { right: { ...OPEN5, wristX: 0.2 }, left: { ...OPEN5, wristX: -0.2 }, face: HAPPY_FACE, holdMs: 240 },
    { right: OPEN5, left: OPEN5, face: HAPPY_FACE, holdMs: 240 },
  ]),
  scared: animSign([
    { right: OPEN5, left: OPEN5, face: SURPRISED_FACE, holdMs: 280 },
    { right: { ...OPEN5, wristX: -0.3 }, left: { ...OPEN5, wristX: -0.3 }, face: SURPRISED_FACE, holdMs: 400 },
  ]),
  afraid: animSign([
    { right: OPEN5, left: OPEN5, face: SURPRISED_FACE, holdMs: 280 },
    { right: { ...OPEN5, wristX: -0.3 }, left: { ...OPEN5, wristX: -0.3 }, face: SURPRISED_FACE, holdMs: 400 },
  ]),
  nervous: animSign([
    { right: OPEN5, left: OPEN5, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.2 }, holdMs: 260 },
    { right: { ...OPEN5, wristX: 0.15 }, left: { ...OPEN5, wristX: -0.15 }, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.2 }, holdMs: 260 },
    { right: OPEN5, left: OPEN5, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.2 }, holdMs: 260 },
  ]),
  proud: animSign([
    { right: A_SHAPE, left: FIST, face: { ...HAPPY_FACE, eyebrowRaise: 0.1 }, holdMs: 280 },
    { right: { ...A_SHAPE, wristX: 0.3 }, left: FIST, face: { ...HAPPY_FACE, eyebrowRaise: 0.1 }, holdMs: 400 },
  ]),
  surprised: animSign([
    { right: CURVED, left: CURVED, face: SURPRISED_FACE, holdMs: 300 },
    { right: OPEN5, left: OPEN5, face: SURPRISED_FACE, holdMs: 500 },
  ]),
  shocked: animSign([
    { right: CURVED, left: CURVED, face: SURPRISED_FACE, holdMs: 300 },
    { right: OPEN5, left: OPEN5, face: SURPRISED_FACE, holdMs: 500 },
  ]),
  confused: animSign([
    { right: CLAW, left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...CLAW, wristZ: 0.3 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: CLAW, left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
  ]),
  frustrated: animSign([
    { right: FLAT_B, left: FIST, face: ANGRY_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: -0.25 }, left: FIST, face: ANGRY_FACE, holdMs: 280 },
    { right: FLAT_B, left: FIST, face: ANGRY_FACE, holdMs: 280 },
  ]),
  tired: animSign([
    { right: CURVED, left: CURVED, face: { ...SAD_FACE, eyeSquint: 0.5 }, holdMs: 280 },
    { right: { ...CURVED, wristX: -0.3 }, left: { ...CURVED, wristX: -0.3 }, face: { ...SAD_FACE, eyeSquint: 0.5 }, holdMs: 400 },
  ]),
  bored: animSign([
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: -0.3, eyeSquint: 0.2 }, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: -0.3 }, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: -0.3, eyeSquint: 0.2 }, holdMs: 400 },
  ]),
  lonely: animSign([
    { right: POINT_UP, left: FIST, face: SAD_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.35 }, left: FIST, face: SAD_FACE, holdMs: 400 },
  ]),
  peaceful: staticSign(OPEN, OPEN, { ...HAPPY_FACE, mouthOpen: 0, mouthSmile: 0.3, eyeSquint: 0.2 }),
  calm: staticSign(OPEN, OPEN, { ...NEUTRAL_FACE, mouthSmile: 0.2, eyeSquint: 0.1 }),
  depressed: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: -0.35 }, { ...FLAT_B, wristX: -0.35 }, SAD_FACE),
  hope: animSign([
    { right: FLAT_B, left: FLAT_B, face: { ...HAPPY_FACE, eyebrowRaise: 0.2 }, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.2 }, left: { ...FLAT_B, wristX: 0.2 }, face: { ...HAPPY_FACE, eyebrowRaise: 0.2 }, holdMs: 400 },
  ]),
  worried: animSign([
    { right: CURVED, left: CURVED, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...CURVED, wristZ: 0.2 }, left: { ...CURVED, wristZ: -0.2 }, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: CURVED, left: CURVED, face: WH_QUESTION_FACE, holdMs: 280 },
  ]),
  embarrassed: animSign([
    { right: OPEN5, left: OPEN5, face: { ...HAPPY_FACE, mouthSmile: -0.2 }, holdMs: 280 },
    { right: { ...OPEN5, wristX: -0.2 }, left: { ...OPEN5, wristX: -0.2 }, face: { ...HAPPY_FACE, mouthSmile: -0.2 }, holdMs: 400 },
  ]),

  // ── Mental / Cognitive ────────────────────────────────────
  // THINK: index fingertip taps temple
  think: animSign([
    { right: atPos(POINT_UP, AT_TEMPLE, 0.01, +0.07), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(POINT_UP, AT_TEMPLE, 0.01, +0.07), wristZ: 0.18 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  // KNOW: flat B-hand taps forehead/temple
  know: staticSign(atPos(FLAT_B, AT_TEMPLE, 0.01, +0.06), FIST),
  // UNDERSTAND: index at forehead snaps open (index straightens upward)
  understand: animSign([
    { right: atPos(POINT_UP, AT_FOREHEAD, 0.01, +0.04), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(POINT_UP, AT_FOREHEAD, 0.01, +0.04), wristX: 0.30 }, left: FIST, face: NEUTRAL_FACE, holdMs: 440 },
  ]),
  believe: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FIST, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  remember: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: A_SHAPE, left: A_SHAPE, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  forget: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: -0.35 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  imagine: animSign([
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.3 }, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.4 }, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.3 }, holdMs: 400 },
  ]),
  decide: twoFrame(OPEN5, OPEN5, { ...OPEN5, wristX: 0.35 }, { ...OPEN5, wristX: 0.35 }),
  choose: twoFrame(V_SHAPE, OPEN5, FIST, OPEN5),
  // LEARN: curved hand draws info from open palm, lifts to forehead
  learn: animSign([
    { right: O_SHAPE, left: atPos(FLAT_B, 0, 0.12, -0.04), face: NEUTRAL_FACE, holdMs: 280 },
    { right: atPos(FLAT_B, AT_FOREHEAD, 0.01, +0.04), left: atPos(FLAT_B, 0, 0.12, -0.04), face: NEUTRAL_FACE, holdMs: 480 },
  ]),
  teach: twoFrame(O_SHAPE, O_SHAPE, { ...O_SHAPE, wristZ: 0.25 }, { ...O_SHAPE, wristZ: -0.25 }),
  practice: repeated(A_SHAPE, U_SHAPE, { ...A_SHAPE, wristZ: 0.2 }, U_SHAPE),
  study: twoFrame(OPEN5, FLAT_B, { ...OPEN5, wristX: 0.25 }, FLAT_B),

  // ── Actions / Verbs ───────────────────────────────────────
  stop: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.45 }, FLAT_B),
  go: twoFrame(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: 0.32 }, { ...POINT_UP, wristZ: 0.32 }),
  come: twoFrame(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: -0.3 }, { ...POINT_UP, wristZ: -0.3 }),
  // WANT: claw hands held out, palms up, pull toward body (simulate pulling inward)
  want: animSign([
    { right: { ...CURVED, posZ: +0.14, posY: +0.06 }, left: { ...CURVED, posZ: +0.14, posY: +0.06 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FIST, posZ: 0, posY: +0.04 }, left: { ...FIST, posZ: 0, posY: +0.04 }, face: NEUTRAL_FACE, holdMs: 440 },
  ]),
  need: repeated(X_SHAPE, FIST, { ...X_SHAPE, wristX: 0.22 }, FIST),
  have: twoFrame(CURVED, CURVED, FIST, FIST),
  see: staticSign(V_SHAPE, FIST),
  look: animSign([
    { right: V_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...V_SHAPE, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  hear: staticSign(POINT_UP, FIST),
  listen: animSign([
    { right: CURVED, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...CURVED, wristX: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  speak: animSign([
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.3 }, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.2 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.3 }, holdMs: 420 },
  ]),
  talk: animSign([
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.28 }, holdMs: 260 },
    { right: { ...POINT_UP, wristZ: 0.2 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.28 }, holdMs: 260 },
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.28 }, holdMs: 260 },
  ]),
  say: animSign([
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.2 }, holdMs: 300 },
    { right: { ...POINT_UP, wristZ: 0.25 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.2 }, holdMs: 400 },
  ]),
  tell: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.22 }, FIST),
  ask: animSign([
    { right: POINT_UP, left: FIST, face: QUESTION_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristX: 0.2 }, left: FIST, face: QUESTION_FACE, holdMs: 400 },
  ]),
  answer: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.28 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  sign: twoFrame(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: 0.3 }, { ...POINT_UP, wristZ: -0.3 }),
  write: repeated(X_SHAPE, FLAT_B, { ...X_SHAPE, wristZ: 0.2 }, FLAT_B),
  read: twoFrame(V_SHAPE, FLAT_B, { ...V_SHAPE, wristX: 0.3 }, FLAT_B),
  watch: animSign([
    { right: V_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...V_SHAPE, wristZ: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  // EAT / FOOD: bunched-O hand taps mouth repeatedly
  eat: animSign([
    { right: atPos(O_SHAPE, AT_MOUTH, 0.02, +0.04), left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.28 }, holdMs: 260 },
    { right: { ...atPos(O_SHAPE, AT_MOUTH + 0.04, 0.02, +0.04), wristX: 0.20 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.28 }, holdMs: 240 },
    { right: atPos(O_SHAPE, AT_MOUTH, 0.02, +0.04), left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.28 }, holdMs: 260 },
  ]),
  // DRINK: curved hand like holding a cup, tilts toward mouth
  drink: animSign([
    { right: atPos(CURVED, AT_MOUTH, 0.03, +0.04), left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.30 }, holdMs: 280 },
    { right: { ...atPos(CURVED, AT_MOUTH + 0.04, 0.03, +0.04), wristX: 0.30 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.30 }, holdMs: 280 },
    { right: atPos(CURVED, AT_MOUTH, 0.03, +0.04), left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.30 }, holdMs: 240 },
  ]),
  cook: repeated(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.3 }, { ...FLAT_B, wristZ: 0.3 }),
  // SLEEP: open hand draws down over face — starts at forehead, closes to cheek
  sleep: animSign([
    { right: atPos(OPEN5, AT_EYE, 0.01, +0.04), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(OPEN5, AT_CHEEK, 0.01, +0.04), wristX: 0.32 }, left: FIST, face: { ...NEUTRAL_FACE, eyeSquint: 1 }, holdMs: 480 },
  ]),
  wake: twoFrame({ ...OPEN5, wristX: 0.3 }, FIST, OPEN5, FIST, { ...NEUTRAL_FACE, eyebrowRaise: 0.4 }),
  // WORK: right S-hand (wrist) taps left S-hand — both hands meet at center
  work: animSign([
    { right: { ...S_SHAPE, posX: +0.06 }, left: { ...S_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...S_SHAPE, posX: +0.06, wristX: 0.22 }, left: { ...S_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 260 },
    { right: { ...S_SHAPE, posX: +0.06 }, left: { ...S_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 260 },
  ]),
  play: repeated(Y_SHAPE, Y_SHAPE, { ...Y_SHAPE, wristZ: 0.32 }, { ...Y_SHAPE, wristZ: -0.32 }, HAPPY_FACE),
  run: repeated(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristZ: 0.3 }, { ...L_SHAPE, wristZ: 0.3 }),
  walk: repeated(V_SHAPE, FIST, { ...V_SHAPE, wristX: 0.2 }, FIST),
  sit: twoFrame(U_SHAPE, U_SHAPE, { ...U_SHAPE, wristX: 0.4 }, U_SHAPE),
  stand: staticSign(V_SHAPE, FLAT_B),
  jump: twoFrame(V_SHAPE, FLAT_B, { ...V_SHAPE, wristX: -0.3 }, FLAT_B),
  swim: repeated(OPEN5, OPEN5, { ...OPEN5, wristZ: 0.25 }, { ...OPEN5, wristZ: -0.25 }),
  drive: repeated(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristZ: 0.3 }, { ...A_SHAPE, wristZ: -0.3 }),
  fly: animSign([
    { right: Y_SHAPE, left: Y_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...Y_SHAPE, wristX: -0.2 }, left: { ...Y_SHAPE, wristX: -0.2 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  give: twoFrame(FLAT_O, FIST, { ...FLAT_O, wristZ: 0.3 }, FIST),
  take: twoFrame(OPEN5, FIST, FIST, FIST),
  bring: twoFrame(FLAT_O, FLAT_O, { ...FLAT_O, wristZ: -0.3 }, { ...FLAT_O, wristZ: -0.3 }),
  send: twoFrame(FLAT_O, FIST, { ...FLAT_O, wristZ: 0.35 }, FIST),
  receive: twoFrame(OPEN5, OPEN5, FIST, FIST),
  get: twoFrame(OPEN5, FIST, FIST, FIST),
  put: twoFrame(FLAT_O, FIST, { ...FLAT_O, wristX: 0.3 }, FIST),
  pick: twoFrame(OPEN5, FIST, F_SHAPE, FIST),
  open: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.4 }, { ...FLAT_B, wristZ: -0.4 }),
  close: twoFrame({ ...FLAT_B, wristZ: 0.4 }, { ...FLAT_B, wristZ: -0.4 }, FLAT_B, FLAT_B),
  start: twoFrame(OPEN5, FIST, F_SHAPE, FIST),
  begin: twoFrame(OPEN5, FIST, F_SHAPE, FIST),
  finish: animSign([
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...OPEN5, wristZ: -0.4 }, left: { ...OPEN5, wristZ: 0.4 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  done: animSign([
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...OPEN5, wristZ: -0.4 }, left: { ...OPEN5, wristZ: 0.4 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  continue: twoFrame(Y_SHAPE, Y_SHAPE, { ...Y_SHAPE, wristZ: 0.25 }, { ...Y_SHAPE, wristZ: 0.25 }),
  find: twoFrame(OPEN5, FIST, F_SHAPE, FIST),
  keep: twoFrame(K_SHAPE, FIST, { ...K_SHAPE, wristX: 0.2 }, FIST),
  use: repeated(U_SHAPE, FIST, { ...U_SHAPE, wristZ: 0.2 }, FIST),
  make: twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristZ: 0.2 }, S_SHAPE),
  build: repeated(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.2 }, S_SHAPE),
  create: repeated(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.2 }, S_SHAPE),
  try: twoFrame(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristZ: 0.3 }, { ...A_SHAPE, wristZ: 0.3 }),
  show: twoFrame(POINT_UP, FLAT_B, { ...POINT_UP, wristZ: 0.3 }, { ...FLAT_B, wristZ: 0.3 }),
  wait: repeated(OPEN5, OPEN5, { ...OPEN5, wristZ: 0.15 }, { ...OPEN5, wristZ: -0.15 }),
  meet: twoFrame(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: 0.3 }, { ...POINT_UP, wristZ: -0.3 }),
  leave: twoFrame(OPEN5, FIST, { ...OPEN5, wristZ: -0.3 }, FIST),
  arrive: twoFrame(OPEN5, FLAT_B, FIST, FLAT_B),
  travel: repeated(V_SHAPE, FIST, { ...V_SHAPE, wristZ: 0.3 }, FIST),
  visit: repeated(V_SHAPE, FIST, { ...V_SHAPE, wristY: 0.3 }, FIST),
  live: twoFrame(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristX: 0.3 }, { ...L_SHAPE, wristX: 0.3 }),
  die: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: -0.5 }, { ...FLAT_B, wristZ: 0.5 }),
  born: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.3 }, FLAT_B),
  grow: twoFrame(S_SHAPE, OPEN, { ...S_SHAPE, wristX: -0.3 }, OPEN5),
  change: twoFrame(X_SHAPE, X_SHAPE, { ...X_SHAPE, wristZ: 0.5 }, { ...X_SHAPE, wristZ: -0.5 }),
  move: twoFrame(FLAT_O, FLAT_O, { ...FLAT_O, wristZ: 0.3 }, { ...FLAT_O, wristZ: 0.3 }),
  return: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristZ: -0.3 }, FIST),
  buy: twoFrame(FLAT_O, FLAT_B, { ...FLAT_O, wristX: 0.3 }, FLAT_B),
  sell: twoFrame(FLAT_O, FLAT_B, { ...FLAT_O, wristZ: 0.3 }, FLAT_B),
  pay: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.3 }, FLAT_B),
  cost: twoFrame(X_SHAPE, FLAT_B, { ...X_SHAPE, wristX: 0.3 }, FLAT_B),
  win: animSign([
    { right: S_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...S_SHAPE, wristX: -0.3 }, left: FIST, face: HAPPY_FACE, holdMs: 420 },
  ]),
  lose: animSign([
    { right: V_SHAPE, left: FIST, face: SAD_FACE, holdMs: 280 },
    { right: FIST, left: FIST, face: SAD_FACE, holdMs: 420 },
  ]),
  wash: repeated(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristZ: 0.3 }, { ...A_SHAPE, wristZ: -0.3 }),
  clean: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.3 }, FLAT_B),
  shower: animSign([
    { right: CURVED, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...CURVED, wristX: -0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: CURVED, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  call: animSign([
    { right: Y_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 300 },
    { right: { ...Y_SHAPE, wristX: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  text: twoFrame(X_SHAPE, FLAT_B, { ...X_SHAPE, wristZ: 0.2 }, FLAT_B),
  share: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.35 }, { ...FLAT_B, wristZ: 0.35 }),
  // HELP: flat left palm supports right A-hand, lifts upward together
  help: animSign([
    { right: { ...A_SHAPE, posX: +0.06, posY: 0 }, left: { ...FLAT_B, posX: -0.06, posY: 0 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...A_SHAPE, posX: +0.06, posY: +0.10 }, left: { ...FLAT_B, posX: -0.06, posY: +0.10 }, face: NEUTRAL_FACE, holdMs: 440 },
  ]),
  fight: repeated(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristZ: 0.3 }, { ...A_SHAPE, wristZ: -0.3 }, ANGRY_FACE),
  protect: twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.25 }, S_SHAPE),
  hurry: repeated(S_SHAPE, FIST, { ...S_SHAPE, wristX: 0.2 }, FIST),
  rest: staticSign(OPEN, OPEN, { ...NEUTRAL_FACE, eyeSquint: 0.2 }),
  relax: staticSign(OPEN, OPEN, { ...NEUTRAL_FACE, eyeSquint: 0.15 }),

  // ── Modifiers / Adverbs ───────────────────────────────────
  // MORE: O-fingertips tap together — both hands meet at center
  more: animSign([
    { right: { ...O_SHAPE, posX: +0.08, posY: +0.06 }, left: { ...O_SHAPE, posX: -0.08, posY: +0.06 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...O_SHAPE, posX: +0.08, posY: +0.06, wristX: 0.18 }, left: { ...O_SHAPE, posX: -0.08, posY: +0.06 }, face: NEUTRAL_FACE, holdMs: 260 },
    { right: { ...O_SHAPE, posX: +0.08, posY: +0.06 }, left: { ...O_SHAPE, posX: -0.08, posY: +0.06 }, face: NEUTRAL_FACE, holdMs: 260 },
  ]),
  less: twoFrame(O_SHAPE, O_SHAPE, { ...O_SHAPE, wristX: -0.2 }, O_SHAPE),
  again: twoFrame(CURVED, FLAT_B, FLAT_B, FLAT_B),
  also: twoFrame(Y_SHAPE, FIST, { ...Y_SHAPE, wristZ: 0.3 }, FIST),
  too: twoFrame(Y_SHAPE, FIST, { ...Y_SHAPE, wristZ: 0.3 }, FIST),
  very: twoFrame(V_SHAPE, V_SHAPE, { ...V_SHAPE, wristZ: 0.4 }, { ...V_SHAPE, wristZ: -0.4 }),
  really: repeated(R_SHAPE, FIST, { ...R_SHAPE, wristX: 0.2 }, FIST),
  not: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ: -0.35 }, FIST),
  never: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: -0.5 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  always: repeated(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.3 }, FIST),
  sometimes: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: { ...POINT_UP, wristZ: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
  ]),
  usually: repeated(U_SHAPE, FIST, { ...U_SHAPE, wristX: 0.2 }, FIST),
  often: repeated(O_SHAPE, FIST, { ...O_SHAPE, wristX: 0.2 }, FIST),
  still: staticSign(Y_SHAPE, Y_SHAPE),
  yet: staticSign(Y_SHAPE, FIST),
  already: twoFrame(Y_SHAPE, FIST, { ...Y_SHAPE, wristZ: 0.3 }, FIST),
  soon: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  just: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristX: 0.2 }, FIST),
  only: staticSign(POINT_UP, FIST),
  enough: twoFrame(S_SHAPE, FLAT_B, { ...S_SHAPE, wristZ: 0.3 }, FLAT_B),
  almost: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.25 }, FLAT_B),
  together: twoFrame(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristY: 0.3 }, { ...A_SHAPE, wristY: -0.3 }),
  alone: staticSign(POINT_UP, FIST, NEUTRAL_FACE, 700),
  actually: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ: 0.25 }, FIST),

  // ── Connectors ────────────────────────────────────────────
  and: twoFrame(OPEN5, FIST, O_SHAPE, FIST),
  but: twoFrame(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: 0.4 }, { ...POINT_UP, wristZ: -0.4 }),
  or: twoFrame(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristZ: 0.3 }, { ...L_SHAPE, wristZ: -0.3 }),
  because: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: 0.2 }, FIST),
  so: twoFrame(S_SHAPE, FIST, { ...S_SHAPE, wristZ: 0.25 }, FIST),
  if: twoFrame(F_SHAPE, FIST, { ...F_SHAPE, wristX: 0.2 }, FIST),
  then: twoFrame(T_SHAPE, FIST, { ...T_SHAPE, wristZ: 0.3 }, FIST),
  with: twoFrame(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristY: 0.25 }, { ...A_SHAPE, wristY: -0.25 }),
  without: twoFrame(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristZ: 0.4 }, { ...A_SHAPE, wristZ: -0.4 }),
  about: repeated(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.3 }, FIST),
  like: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristX: 0.3 }, FIST),
  than: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.25 }, FLAT_B),
  for: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.3 }, FIST),

  // ── Time Words ────────────────────────────────────────────
  today: repeated(Y_SHAPE, Y_SHAPE, { ...Y_SHAPE, wristX: 0.22 }, { ...Y_SHAPE, wristX: 0.22 }),
  tomorrow: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ: 0.32 }, FIST),
  yesterday: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ: -0.32 }, FIST),
  now: repeated(Y_SHAPE, Y_SHAPE, { ...Y_SHAPE, wristX: 0.22 }, { ...Y_SHAPE, wristX: 0.22 }),
  later: twoFrame(L_SHAPE, FIST, { ...L_SHAPE, wristZ: 0.35 }, FIST),
  before: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: -0.32 }, FLAT_B),
  after: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.32 }, FLAT_B),
  morning: animSign([
    { right: FLAT_B, left: CURVED, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: -0.3 }, left: CURVED, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  afternoon: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.3 }, FLAT_B),
  evening: twoFrame(FLAT_B, CURVED, { ...FLAT_B, wristX: 0.3 }, CURVED),
  night: twoFrame(FLAT_B, CURVED, { ...FLAT_B, wristX: -0.3 }, CURVED),
  midnight: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: -0.4 }, FLAT_B),
  hour: repeated(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.3 }, FIST),
  minute: repeated(POINT_UP, FLAT_B, { ...POINT_UP, wristX: 0.18 }, FLAT_B),
  second: repeated(POINT_UP, FLAT_B, { ...POINT_UP, wristX: 0.1 }, FLAT_B),
  day: twoFrame(D_SHAPE, FLAT_B, { ...D_SHAPE, wristX: 0.35 }, FLAT_B),
  week: twoFrame(POINT_UP, FLAT_B, { ...POINT_UP, wristZ: 0.35 }, FLAT_B),
  month: repeated(POINT_UP, POINT_UP, { ...POINT_UP, wristX: 0.25 }, POINT_UP),
  year: twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristZ: 0.5 }, S_SHAPE),
  time: repeated(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.25 }, FIST),
  early: twoFrame(S_SHAPE, CURVED, { ...S_SHAPE, wristZ: 0.3 }, CURVED),
  late: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: -0.3 }, FIST),
  long: animSign([
    { right: POINT_UP, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.4 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  short: animSign([
    { right: H_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...H_SHAPE, wristZ: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  future: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: 0.4 }, FIST),
  past: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: -0.4 }, FIST),
  ago: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: -0.35 }, FIST),
  history: twoFrame(H_SHAPE, FIST, { ...H_SHAPE, wristZ: -0.3 }, FIST),

  // ── People & Relationships ────────────────────────────────
  // NAME: H-hands tap together (index+middle extended, tapping at center)
  name: animSign([
    { right: { ...H_SHAPE, posX: +0.06 }, left: { ...H_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...H_SHAPE, posX: +0.06, wristX: 0.22 }, left: { ...H_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 260 },
    { right: { ...H_SHAPE, posX: +0.06 }, left: { ...H_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 260 },
  ]),
  person: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.3 }, { ...FLAT_B, wristX: 0.3 }),
  people: repeated(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.25 }, { ...FLAT_B, wristZ: -0.25 }),
  man: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: 0.22 }, FIST),
  woman: twoFrame(A_SHAPE, FIST, { ...FLAT_B, wristX: 0.22 }, FIST),
  boy: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: 0.25 }, FIST),
  girl: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristX: -0.25 }, FIST),
  child: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: -0.3 }, FIST),
  baby: repeated(CURVED, CURVED, { ...CURVED, wristX: 0.2 }, { ...CURVED, wristX: 0.2 }, { ...NEUTRAL_FACE, mouthSmile: 0.5 }),
  // FRIEND: H-shapes (hooked index+middle) link and swap — both hands meet at center
  friend: animSign([
    { right: { ...H_SHAPE, posX: +0.08 }, left: { ...H_SHAPE, posX: -0.08 }, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...H_SHAPE, posX: +0.08, wristX: 0.25 }, left: { ...H_SHAPE, posX: -0.08, wristX: 0.25 }, face: HAPPY_FACE, holdMs: 440 },
  ]),
  // FAMILY: F-shapes start together at center, circle outward and forward
  family: animSign([
    { right: { ...F_SHAPE, posX: +0.06 }, left: { ...F_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...F_SHAPE, wristZ: 0.38, posX: -0.02 }, left: { ...F_SHAPE, wristZ: -0.38, posX: +0.02 }, face: NEUTRAL_FACE, holdMs: 480 },
  ]),
  // MOTHER: open-5 hand, thumb touches chin (thumb side of hand at chin)
  mother: staticSign(
    { ...OPEN5, posY: AT_CHIN, posX: +0.05, posZ: 0.03, wristZ: -0.12 },
    FIST, NEUTRAL_FACE, 720),
  // FATHER: open-5 hand, thumb touches forehead
  father: staticSign(
    { ...OPEN5, posY: AT_FOREHEAD, posX: +0.04, posZ: 0.01, wristZ: -0.10 },
    FIST, NEUTRAL_FACE, 720),
  // MOM: same as MOTHER
  mom: staticSign(
    { ...OPEN5, posY: AT_CHIN, posX: +0.05, posZ: 0.03, wristZ: -0.12 },
    FIST, NEUTRAL_FACE, 720),
  // DAD: same as FATHER
  dad: staticSign(
    { ...OPEN5, posY: AT_FOREHEAD, posX: +0.04, posZ: 0.01, wristZ: -0.10 },
    FIST, NEUTRAL_FACE, 720),
  brother: twoFrame(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristX: 0.3 }, L_SHAPE),
  sister: twoFrame(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristX: -0.3 }, L_SHAPE),
  son: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: CURVED, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  daughter: animSign([
    { right: A_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: CURVED, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  husband: animSign([
    { right: G_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: CURVED, left: CURVED, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  wife: animSign([
    { right: A_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: CURVED, left: CURVED, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  parent: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.2 }, FLAT_B),
  grandma: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: { ...FLAT_B, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
  ]),
  grandpa: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: { ...FLAT_B, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
  ]),
  teacher: twoFrame(O_SHAPE, O_SHAPE, { ...O_SHAPE, wristZ: 0.25 }, { ...O_SHAPE, wristZ: -0.25 }),
  student: twoFrame(O_SHAPE, FLAT_B, { ...FLAT_B, wristX: 0.3 }, FLAT_B),
  doctor: repeated(D_SHAPE, FIST, { ...D_SHAPE, wristX: 0.2 }, FIST),
  nurse: animSign([
    { right: N_SHAPE, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...N_SHAPE, wristX: 0.2 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  police: animSign([
    { right: CURVED, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...CURVED, wristX: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  boss: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.2 }, FIST),
  neighbor: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.3 }, FLAT_B),
  stranger: twoFrame(S_SHAPE, FIST, { ...S_SHAPE, wristZ: 0.3 }, FIST),

  // ── Body Parts ────────────────────────────────────────────
  head: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.25 }, FIST),
  face: repeated(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.3 }, FIST),
  hair: repeated(G_SHAPE, FIST, { ...G_SHAPE, wristX: -0.2 }, FIST),
  eye: twoFrame(V_SHAPE, FIST, { ...V_SHAPE, wristZ: 0.25 }, FIST),
  eyes: twoFrame(V_SHAPE, FIST, { ...V_SHAPE, wristZ: 0.25 }, FIST),
  ear: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.2 }, FIST),
  nose: twoFrame(D_SHAPE, FIST, { ...D_SHAPE, wristZ: 0.2 }, FIST),
  mouth: repeated(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.3 }, FIST),
  tooth: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristX: 0.2 }, FIST),
  tongue: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristX: 0.25 }, FIST),
  neck: twoFrame(V_SHAPE, FIST, { ...V_SHAPE, wristZ: 0.3 }, FIST),
  shoulder: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.3 }, FIST),
  arm: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: 0.3 }, FIST),
  hand: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.25 }, FLAT_B),
  finger: twoFrame(G_SHAPE, FIST, { ...G_SHAPE, wristZ: 0.25 }, FIST),
  chest: staticSign(FLAT_B, FIST),
  heart: repeated(CURVED, FIST, { ...CURVED, wristX: 0.2 }, FIST),
  stomach: twoFrame(CURVED, FIST, { ...CURVED, wristZ: 0.3 }, FIST),
  back: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: -0.3 }, FIST),
  leg: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristX: 0.3 }, FIST),
  knee: repeated(POINT_UP, FIST, { ...POINT_UP, wristX: 0.25 }, FIST),
  foot: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.35 }, FIST),
  brain: repeated(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.2 }, FIST),
  blood: twoFrame(CURVED, FIST, { ...CURVED, wristX: -0.25 }, FIST),

  // ── Food & Drink ──────────────────────────────────────────
  // FOOD: same motion as EAT — O-hand repeatedly to mouth
  food: animSign([
    { right: atPos(O_SHAPE, AT_MOUTH, 0.02, +0.04), left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.25 }, holdMs: 260 },
    { right: { ...atPos(O_SHAPE, AT_MOUTH + 0.04, 0.02, +0.04), wristX: 0.20 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.25 }, holdMs: 240 },
    { right: atPos(O_SHAPE, AT_MOUTH, 0.02, +0.04), left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.25 }, holdMs: 240 },
  ]),
  // WATER: W-hand taps chin/mouth — W held at lower face
  water: animSign([
    { right: atPos(W_SHAPE, AT_MOUTH, 0.02, +0.04), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(W_SHAPE, AT_MOUTH, 0.02, +0.04), wristX: 0.20 }, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: atPos(W_SHAPE, AT_MOUTH, 0.02, +0.04), left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
  ]),
  hungry: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.35 }, FIST),
  thirsty: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristX: 0.4 }, FIST),
  apple: repeated(A_SHAPE, FIST, { ...A_SHAPE, wristZ: 0.25 }, FIST),
  orange: repeated(CURVED, FIST, FIST, FIST),
  banana: animSign([
    { right: G_SHAPE, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...G_SHAPE, wristX: 0.3 }, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  bread: repeated(FLAT_B, CURVED, { ...FLAT_B, wristZ: 0.3 }, CURVED),
  milk: repeated(CURVED, FIST, FIST, FIST),
  coffee: repeated(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristZ: 0.3 }, S_SHAPE),
  tea: animSign([
    { right: F_SHAPE, left: O_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...F_SHAPE, wristZ: 0.3 }, left: O_SHAPE, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  juice: repeated(A_SHAPE, FIST, { ...A_SHAPE, wristX: 0.25 }, FIST),
  rice: repeated(R_SHAPE, FIST, { ...R_SHAPE, wristX: 0.22 }, FIST),
  chicken: repeated(G_SHAPE, FLAT_B, { ...G_SHAPE, wristX: 0.2 }, FLAT_B),
  fish: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: -0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  egg: twoFrame(F_SHAPE, F_SHAPE, { ...F_SHAPE, wristZ: 0.4 }, { ...F_SHAPE, wristZ: -0.4 }),
  cheese: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.3 }, { ...FLAT_B, wristZ: -0.3 }),
  pizza: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: 0.3 }, FIST),
  cake: twoFrame(CURVED, FLAT_B, { ...CURVED, wristX: 0.3 }, FLAT_B),
  cookie: repeated(CURVED, FLAT_B, { ...CURVED, wristZ: 0.3 }, FLAT_B),
  chocolate: repeated(C_SHAPE, FIST, { ...C_SHAPE, wristZ: 0.25 }, FIST),
  sugar: repeated(U_SHAPE, FIST, { ...U_SHAPE, wristZ: 0.2 }, FIST),
  salt: twoFrame(V_SHAPE, FIST, { ...V_SHAPE, wristX: 0.3 }, FIST),
  breakfast: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.25 }, holdMs: 420 },
  ]),
  lunch: animSign([
    { right: L_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.25 }, holdMs: 420 },
  ]),
  dinner: animSign([
    { right: D_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.25 }, holdMs: 420 },
  ]),
  snack: animSign([
    { right: S_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.22 }, holdMs: 420 },
  ]),
  restaurant: repeated(R_SHAPE, FIST, { ...R_SHAPE, wristZ: 0.25 }, FIST),

  // ── Descriptors / Adjectives ──────────────────────────────
  big: twoFrame(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristY: -0.4 }, { ...L_SHAPE, wristY: 0.4 }),
  small: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristY: 0.3 }, { ...FLAT_B, wristY: -0.3 }),
  large: twoFrame(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristY: -0.45 }, { ...L_SHAPE, wristY: 0.45 }),
  little: twoFrame(G_SHAPE, G_SHAPE, { ...G_SHAPE, wristY: 0.3 }, { ...G_SHAPE, wristY: -0.3 }),
  tall: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: -0.4 }, FIST),
  heavy: twoFrame(OPEN5, OPEN5, { ...OPEN5, wristX: 0.4 }, { ...OPEN5, wristX: 0.4 }),
  light: twoFrame(OPEN5, OPEN5, { ...OPEN5, wristX: -0.3 }, { ...OPEN5, wristX: -0.3 }),
  hot: twoFrame(CURVED, FIST, { ...CURVED, wristZ: -0.35 }, FIST),
  cold: repeated(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristZ: 0.2 }, { ...S_SHAPE, wristZ: -0.2 }),
  warm: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.25 }, FIST),
  cool: twoFrame(OPEN5, FIST, { ...OPEN5, wristX: -0.2 }, FIST),
  fast: twoFrame(L_SHAPE, L_SHAPE, FIST, FIST),
  slow: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.2 }, FLAT_B),
  easy: twoFrame(CURVED, FLAT_B, { ...CURVED, wristX: 0.25 }, FLAT_B),
  hard: twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.25 }, S_SHAPE),
  difficult: twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.25 }, S_SHAPE),
  same: twoFrame(Y_SHAPE, FIST, { ...Y_SHAPE, wristZ: 0.3 }, FIST),
  different: twoFrame(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: -0.4 }, { ...POINT_UP, wristZ: 0.4 }),
  new: twoFrame(CURVED, FLAT_B, { ...CURVED, wristX: 0.25 }, FLAT_B),
  old: twoFrame(CURVED, FIST, FIST, FIST),
  young: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.25 }, FIST),
  dirty: repeated(CURVED, FIST, { ...CURVED, wristZ: 0.25 }, FIST),
  loud: twoFrame(OPEN5, FIST, { ...OPEN5, wristZ: 0.3 }, FIST),
  quiet: twoFrame(OPEN5, FIST, { ...OPEN5, wristZ: -0.3 }, FIST),
  safe: twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.3 }, S_SHAPE),
  dangerous: repeated(D_SHAPE, S_SHAPE, { ...D_SHAPE, wristZ: 0.25 }, S_SHAPE, INTENSE_FACE),
  important: twoFrame(F_SHAPE, FIST, { ...F_SHAPE, wristX: 0.3 }, FIST),
  special: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristX: 0.3 }, FIST),
  normal: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.25 }, FLAT_B),
  ready: repeated(R_SHAPE, FIST, { ...R_SHAPE, wristZ: 0.25 }, FIST),
  busy: repeated(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.2 }, S_SHAPE),
  free: twoFrame(F_SHAPE, F_SHAPE, { ...F_SHAPE, wristZ: 0.4 }, { ...F_SHAPE, wristZ: -0.4 }),
  rich: twoFrame(FLAT_B, O_SHAPE, { ...FLAT_B, wristX: 0.3 }, O_SHAPE),
  poor: twoFrame(CURVED, FIST, { ...CURVED, wristX: -0.25 }, FIST),
  expensive: twoFrame(FLAT_B, O_SHAPE, { ...FLAT_B, wristX: 0.3 }, OPEN5),
  cheap: twoFrame(CURVED, FLAT_B, { ...CURVED, wristX: 0.3 }, FLAT_B),
  healthy: twoFrame(H_SHAPE, H_SHAPE, { ...H_SHAPE, wristX: 0.25 }, H_SHAPE),
  alive: twoFrame(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristX: 0.3 }, { ...L_SHAPE, wristX: 0.3 }),
  dead: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: -0.5 }, { ...FLAT_B, wristZ: 0.5 }),
  broken: twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristZ: 0.5 }, { ...S_SHAPE, wristZ: -0.5 }, SAD_FACE),
  full: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.35 }, FIST),
  empty: twoFrame(OPEN5, FIST, { ...OPEN5, wristX: -0.3 }, FIST),
  closed: twoFrame({ ...FLAT_B, wristZ: 0.4 }, { ...FLAT_B, wristZ: -0.4 }, FLAT_B, FLAT_B),
  real: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristX: 0.25 }, FIST),
  fake: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristZ: -0.35 }, FIST),
  perfect: twoFrame(F_SHAPE, F_SHAPE, { ...F_SHAPE, wristZ: 0.3 }, { ...F_SHAPE, wristZ: 0.3 }),

  // ── Colors ────────────────────────────────────────────────
  red: repeated(POINT_UP, FIST, { ...POINT_UP, wristX: 0.22 }, FIST),
  blue: repeated(FINGERSPELLING.B, FIST, { ...FINGERSPELLING.B, wristZ: 0.3 }, FIST),
  green: repeated(FINGERSPELLING.G, FIST, { ...FINGERSPELLING.G, wristZ: 0.2 }, FIST),
  yellow: repeated(Y_SHAPE, FIST, { ...Y_SHAPE, wristZ: 0.28 }, FIST),
  white: twoFrame(CURVED, FIST, O_SHAPE, FIST),
  black: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristZ: -0.4 }, FIST),
  purple: repeated(FINGERSPELLING.P, FIST, { ...FINGERSPELLING.P, wristZ: 0.25 }, FIST),
  pink: repeated(FINGERSPELLING.P, FIST, { ...FINGERSPELLING.P, wristX: 0.2 }, FIST),
  brown: repeated(FINGERSPELLING.B, FIST, { ...FINGERSPELLING.B, wristX: 0.25 }, FIST),
  gray: repeated(OPEN5, OPEN5, { ...OPEN5, wristZ: 0.2 }, { ...OPEN5, wristZ: -0.2 }),
  color: repeated(CURVED, FIST, { ...CURVED, wristZ: 0.25 }, FIST),

  // ── Numbers ───────────────────────────────────────────────
  zero: staticSign(O_SHAPE, FIST),
  one:   staticSign({ ...POINT_UP, thumb: { flex: 0.72, abd: 0 } }, FIST),
  two:   staticSign(V_SHAPE, FIST),
  three: staticSign({ thumb: { flex: 0.1, abd: 0.7 }, index: { curl: 0, spread: -0.2 }, middle: { curl: 0, spread: 0.2 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, FIST),
  four:  staticSign({ thumb: { flex: 0.8, abd: 0 }, index: { curl: 0, spread: -0.28 }, middle: { curl: 0, spread: -0.08 }, ring: { curl: 0, spread: 0.08 }, pinky: { curl: 0, spread: 0.28 } }, FIST),
  five:  staticSign(OPEN5, FIST),
  six:   staticSign({ thumb: { flex: 0.1, abd: 0.6 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0, spread: 0 } }, FIST),
  seven: staticSign({ thumb: { flex: 0.1, abd: 0.6 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, FIST),
  eight: staticSign({ thumb: { flex: 0.2, abd: 0.5 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, FIST),
  nine:  staticSign({ thumb: { flex: 0.3, abd: 0.5 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, FIST),
  ten:   animSign([
    { right: A_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...A_SHAPE, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  eleven: repeated(L_SHAPE, FIST, { ...L_SHAPE, wristX: 0.2 }, FIST),
  twelve: repeated(V_SHAPE, FIST, { ...V_SHAPE, wristX: 0.2 }, FIST),
  thirteen: animSign([
    { right: { ...POINT_UP, thumb: { flex: 0.72, abd: 0 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: T_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: { thumb: { flex: 0.1, abd: 0.7 }, index: { curl: 0, spread: -0.2 }, middle: { curl: 0, spread: 0.2 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 300 },
  ]),
  // FOURTEEN–NINETEEN: show the number handshape with a small shake
  fourteen: repeated(
    { thumb: { flex: 0.8, abd: 0 }, index: { curl: 0, spread: -0.28 }, middle: { curl: 0, spread: -0.08 }, ring: { curl: 0, spread: 0.08 }, pinky: { curl: 0, spread: 0.28 } },
    FIST,
    { thumb: { flex: 0.8, abd: 0 }, index: { curl: 0, spread: -0.28 }, middle: { curl: 0, spread: -0.08 }, ring: { curl: 0, spread: 0.08 }, pinky: { curl: 0, spread: 0.28 }, wristX: 0.18 },
    FIST,
  ),
  fifteen: repeated(OPEN5, FIST, { ...OPEN5, wristX: 0.18 }, FIST),
  sixteen: repeated(
    { thumb: { flex: 0.1, abd: 0.6 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0, spread: 0 } },
    FIST,
    { thumb: { flex: 0.1, abd: 0.6 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0, spread: 0 }, wristX: 0.18 },
    FIST,
  ),
  seventeen: repeated(
    { thumb: { flex: 0.1, abd: 0.6 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
    FIST,
    { thumb: { flex: 0.1, abd: 0.6 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0, spread: 0 }, pinky: { curl: 0.9, spread: 0 }, wristX: 0.18 },
    FIST,
  ),
  eighteen: repeated(
    { thumb: { flex: 0.2, abd: 0.5 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
    FIST,
    { thumb: { flex: 0.2, abd: 0.5 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 }, wristX: 0.18 },
    FIST,
  ),
  nineteen: repeated(
    { thumb: { flex: 0.3, abd: 0.5 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } },
    FIST,
    { thumb: { flex: 0.3, abd: 0.5 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 }, wristX: 0.18 },
    FIST,
  ),
  twenty: animSign([
    { right: V_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  // TWENTY-ONE: V→O then raise index (1-hand)
  'twenty-one': animSign([
    { right: V_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: { ...POINT_UP, thumb: { flex: 0.72, abd: 0 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 340 },
  ]),
  // TENS: each tens number → show the units digit handshape then close to O
  thirty: animSign([
    { right: { thumb: { flex: 0.1, abd: 0.7 }, index: { curl: 0, spread: -0.2 }, middle: { curl: 0, spread: 0.2 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  forty: animSign([
    { right: { thumb: { flex: 0.8, abd: 0 }, index: { curl: 0, spread: -0.28 }, middle: { curl: 0, spread: -0.08 }, ring: { curl: 0, spread: 0.08 }, pinky: { curl: 0, spread: 0.28 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  fifty: animSign([
    { right: OPEN5, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  sixty: animSign([
    { right: { thumb: { flex: 0.1, abd: 0.6 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0, spread: 0 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  seventy: animSign([
    { right: { thumb: { flex: 0.1, abd: 0.6 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  eighty: animSign([
    { right: { thumb: { flex: 0.2, abd: 0.5 }, index: { curl: 0.9, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  ninety: animSign([
    { right: { thumb: { flex: 0.3, abd: 0.5 }, index: { curl: 0, spread: 0 }, middle: { curl: 0.9, spread: 0 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: O_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  hundred: twoFrame(C_SHAPE, FIST, { ...C_SHAPE, wristX: 0.3 }, FIST),
  thousand: twoFrame(FLAT_B, S_SHAPE, { ...FLAT_B, wristX: 0.3 }, S_SHAPE),
  million: repeated(M_SHAPE, FIST, { ...M_SHAPE, wristX: 0.2 }, FIST),

  // ── Places & Locations ────────────────────────────────────
  here: repeated(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.2 }, FIST),
  there: twoFrame(POINT_UP, FIST, { ...POINT_UP, wristZ: 0.35 }, FIST),
  // HOME: O-hand touches cheek then opens to B-hand at same cheek location
  home: animSign([
    { right: atPos(O_SHAPE, AT_CHEEK, 0.02, +0.06), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: atPos(FLAT_B, AT_CHEEK, 0.02, +0.06), left: FIST, face: NEUTRAL_FACE, holdMs: 440 },
  ]),
  house: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: 0.3 }, left: { ...FLAT_B, wristZ: -0.3 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  room: twoFrame(R_SHAPE, R_SHAPE, { ...R_SHAPE, wristZ: 0.4 }, { ...R_SHAPE, wristZ: -0.4 }),
  school: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.32 }, FLAT_B),
  office: repeated(O_SHAPE, FIST, { ...O_SHAPE, wristZ: 0.25 }, FIST),
  store: repeated(S_SHAPE, FIST, { ...S_SHAPE, wristZ: 0.25 }, FIST),
  shop: repeated(S_SHAPE, FIST, { ...S_SHAPE, wristZ: 0.25 }, FIST),
  market: repeated(M_SHAPE, FIST, { ...M_SHAPE, wristZ: 0.25 }, FIST),
  hospital: animSign([
    { right: H_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...H_SHAPE, wristX: 0.25 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  park: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.25 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  street: repeated(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.3 }, { ...FLAT_B, wristZ: 0.3 }),
  road: repeated(R_SHAPE, FIST, { ...R_SHAPE, wristZ: 0.3 }, FIST),
  city: repeated(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristZ: 0.25 }, S_SHAPE),
  town: twoFrame(T_SHAPE, FIST, { ...T_SHAPE, wristZ: 0.3 }, FIST),
  country: twoFrame(CURVED, FIST, { ...CURVED, wristZ: 0.3 }, FIST),
  world: twoFrame(W_SHAPE, W_SHAPE, { ...W_SHAPE, wristZ: 0.5 }, { ...W_SHAPE, wristZ: -0.5 }),
  bathroom: animSign([
    { right: T_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...T_SHAPE, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  kitchen: twoFrame(K_SHAPE, FLAT_B, { ...K_SHAPE, wristZ: 0.3 }, FLAT_B),
  bedroom: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: R_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  library: repeated(L_SHAPE, FIST, { ...L_SHAPE, wristZ: 0.3 }, FIST),
  church: twoFrame(CURVED, CURVED, { ...CURVED, wristZ: 0.35 }, { ...CURVED, wristZ: -0.35 }),
  outside: twoFrame(O_SHAPE, FIST, { ...O_SHAPE, wristZ: 0.35 }, FIST),
  inside: twoFrame(FLAT_O, FIST, { ...FLAT_O, wristX: 0.25 }, FIST),

  // ── Spatial ───────────────────────────────────────────────
  up:    twoFrame(POINT_UP, FIST, { ...POINT_UP, wristX: -0.35 }, FIST),
  down:  twoFrame(POINT_UP, FIST, { ...POINT_UP, wristX:  0.35 }, FIST),
  left:  twoFrame(L_SHAPE,  FIST, { ...L_SHAPE,  wristY: -0.4 },  FIST),
  right: twoFrame(L_SHAPE,  FIST, { ...L_SHAPE,  wristY:  0.4 },  FIST),
  near:  twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: 0.3 }, FIST),
  far:   twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: -0.3 }, FIST),
  next:  twoFrame(FLAT_B, FIST, { ...FLAT_B, wristY: 0.3 }, FIST),
  behind: twoFrame(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristZ: -0.3 }, A_SHAPE),
  front: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristZ: 0.35 }, FIST),
  between: twoFrame(FLAT_B, V_SHAPE, { ...FLAT_B, wristX: 0.3 }, V_SHAPE),
  above:  twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: -0.3 }, FLAT_B),
  below:  twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX:  0.3 }, FLAT_B),
  around: repeated(POINT_UP, FIST, { ...POINT_UP, wristY: 0.4 }, FIST),
  across: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.35 }, FLAT_B),

  // ── Nature & Weather ──────────────────────────────────────
  sun: animSign([
    { right: C_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: OPEN5,   left: FIST, face: HAPPY_FACE, holdMs: 420 },
  ]),
  moon: twoFrame(C_SHAPE, FIST, { ...C_SHAPE, wristX: -0.3 }, FIST),
  star: repeated(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: 0.2 }, { ...POINT_UP, wristZ: -0.2 }),
  sky: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristY: 0.5 }, FIST),
  cloud: twoFrame(CURVED, CURVED, { ...CURVED, wristY: 0.3 }, { ...CURVED, wristY: -0.3 }),
  rain: animSign([
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 240 },
    { right: { ...OPEN5, wristX: 0.3 }, left: { ...OPEN5, wristX: 0.3 }, face: NEUTRAL_FACE, holdMs: 240 },
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 240 },
  ]),
  snow: animSign([
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 240 },
    { right: { ...OPEN5, wristX: 0.28, wristZ: 0.15 }, left: { ...OPEN5, wristX: 0.28, wristZ: -0.15 }, face: NEUTRAL_FACE, holdMs: 240 },
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 240 },
  ]),
  wind: repeated(OPEN5, OPEN5, { ...OPEN5, wristY: 0.3 }, { ...OPEN5, wristY: -0.3 }),
  storm: animSign([
    { right: S_SHAPE, left: S_SHAPE, face: INTENSE_FACE, holdMs: 280 },
    { right: { ...S_SHAPE, wristZ: 0.4 }, left: { ...S_SHAPE, wristZ: -0.4 }, face: INTENSE_FACE, holdMs: 280 },
    { right: S_SHAPE, left: S_SHAPE, face: INTENSE_FACE, holdMs: 280 },
  ]),
  weather: twoFrame(W_SHAPE, FIST, { ...W_SHAPE, wristZ: 0.3 }, FIST),
  earth: twoFrame(E_SHAPE, S_SHAPE, { ...E_SHAPE, wristZ: 0.5 }, S_SHAPE),
  ocean: twoFrame(O_SHAPE, OPEN5, { ...O_SHAPE, wristX: 0.25 }, OPEN5),
  river: twoFrame(R_SHAPE, R_SHAPE, { ...R_SHAPE, wristZ: 0.3 }, { ...R_SHAPE, wristZ: 0.3 }),
  tree: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.3 }, FLAT_B),
  flower: repeated(O_SHAPE, FIST, { ...O_SHAPE, wristZ: 0.2 }, FIST),
  plant: twoFrame(FLAT_B, S_SHAPE, { ...FLAT_B, wristX: -0.3 }, S_SHAPE),
  mountain: animSign([
    { right: S_SHAPE, left: S_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...S_SHAPE, wristX: -0.4 }, left: { ...S_SHAPE, wristX: -0.4 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  fire: animSign([
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 240 },
    { right: { ...OPEN5, wristX: -0.2 }, left: { ...OPEN5, wristX: -0.2 }, face: NEUTRAL_FACE, holdMs: 240 },
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 240 },
  ]),

  // ── Animals ───────────────────────────────────────────────
  dog: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: 0.25 }, FIST),
  cat: twoFrame(F_SHAPE, FIST, { ...F_SHAPE, wristZ: 0.3 }, FIST),
  bird: repeated(G_SHAPE, FIST, { ...G_SHAPE, wristX: 0.2 }, FIST),
  horse: animSign([
    { right: H_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...H_SHAPE, wristX: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: H_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  cow: twoFrame(Y_SHAPE, FIST, { ...Y_SHAPE, wristZ: 0.3 }, FIST),
  bear: twoFrame(CLAW, CLAW, { ...CLAW, wristX: 0.3 }, { ...CLAW, wristX: 0.3 }),
  rabbit: repeated(U_SHAPE, FIST, { ...U_SHAPE, wristX: 0.25 }, FIST),
  lion: twoFrame(CLAW, FIST, { ...CLAW, wristZ: 0.4 }, FIST),
  elephant: twoFrame(S_SHAPE, FIST, { ...S_SHAPE, wristX: 0.4 }, FIST),

  // ── Technology ────────────────────────────────────────────
  phone: staticSign(Y_SHAPE, FIST, NEUTRAL_FACE, 700),
  computer: repeated(C_SHAPE, FIST, { ...C_SHAPE, wristZ: 0.3 }, FIST),
  internet: repeated(I_SHAPE, I_SHAPE, { ...I_SHAPE, wristZ: 0.3 }, { ...I_SHAPE, wristZ: -0.3 }),
  app: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ: 0.3 }, FIST),
  screen: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristY: 0.4 }, { ...FLAT_B, wristY: -0.4 }),
  camera: animSign([
    { right: L_SHAPE, left: CURVED, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...L_SHAPE, wristX: 0.3 }, left: CURVED, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  car: repeated(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristZ: 0.3 }, { ...A_SHAPE, wristZ: -0.3 }),
  bus: twoFrame(FINGERSPELLING.B, FIST, { ...FINGERSPELLING.B, wristZ: 0.3 }, FIST),
  train: twoFrame(H_SHAPE, H_SHAPE, { ...H_SHAPE, wristZ: 0.4 }, H_SHAPE),
  airplane: animSign([
    { right: Y_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...Y_SHAPE, wristX: -0.2, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  bike: repeated(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristZ: 0.4 }, { ...S_SHAPE, wristZ: -0.4 }),
  money: twoFrame(FLAT_O, FLAT_B, { ...FLAT_O, wristX: 0.3 }, FLAT_B),
  book: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.4 }, { ...FLAT_B, wristZ: -0.4 }),

  // ── Possessions & Objects ─────────────────────────────────
  key: repeated(X_SHAPE, FIST, { ...X_SHAPE, wristZ: 0.25 }, FIST),
  door: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.5 }, FLAT_B),
  window: twoFrame(H_SHAPE, H_SHAPE, { ...H_SHAPE, wristX: -0.3 }, H_SHAPE),
  table: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristX: 0.3 }, FLAT_B),
  chair: twoFrame(U_SHAPE, U_SHAPE, { ...U_SHAPE, wristX: 0.4 }, U_SHAPE),
  bed: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: 0.35 }, FIST),
  cup: twoFrame(CURVED, FLAT_B, { ...CURVED, wristX: 0.3 }, FLAT_B),
  bag: twoFrame(S_SHAPE, FIST, { ...S_SHAPE, wristX: 0.3 }, FIST),
  clothes: repeated(OPEN5, OPEN5, { ...OPEN5, wristX: 0.2 }, { ...OPEN5, wristX: 0.2 }),
  hat: twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: 0.3 }, FIST),
  shoes: twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.3 }, S_SHAPE),
  medicine: repeated(M_SHAPE, FLAT_B, { ...M_SHAPE, wristZ: 0.2 }, FLAT_B),
  paper: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.3 }, FLAT_B),
  pen: twoFrame(G_SHAPE, FLAT_B, { ...G_SHAPE, wristZ: 0.25 }, FLAT_B),
  letter: twoFrame(A_SHAPE, FLAT_B, { ...A_SHAPE, wristX: 0.3 }, FLAT_B),
  gift: twoFrame(G_SHAPE, G_SHAPE, { ...G_SHAPE, wristZ: 0.3 }, { ...G_SHAPE, wristZ: 0.3 }),

  // ── Phrases (common multi-word) ───────────────────────────
  'i love you': staticSign(ILY, FIST, { ...HAPPY_FACE, mouthSmile: 0.95 }, 900),
  'i am': staticSign(POINT_UP, FIST),
  "i'm": staticSign(POINT_UP, FIST),
  "i don't know": animSign([
    { right: FLAT_B, left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: -0.4 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 420 },
  ]),
  "don't know": animSign([
    { right: FLAT_B, left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: -0.4 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 420 },
  ]),
  "don't": twoFrame(POINT_UP, FIST, { ...POINT_UP, wristZ: -0.4 }, FIST),
  "can't": twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristX: 0.35 }, FIST),
  "won't": twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ: -0.3 }, FIST),
  "what's up": animSign([
    { right: POINT_UP, left: FIST, face: QUESTION_FACE, holdMs: 300 },
    { right: { ...POINT_UP, wristX: -0.3 }, left: FIST, face: QUESTION_FACE, holdMs: 400 },
  ]),

  // ── ASL-specific terms ────────────────────────────────────
  asl: animSign([
    { right: FINGERSPELLING.A, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: FINGERSPELLING.S, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: FINGERSPELLING.L, left: FIST, face: NEUTRAL_FACE, holdMs: 300 },
  ]),
  deaf: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.3 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  hearing: animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.2 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  interpreter: repeated(V_SHAPE, V_SHAPE, { ...V_SHAPE, wristZ: 0.3 }, { ...V_SHAPE, wristZ: -0.3 }),

  // ── Modal verbs ───────────────────────────────────────────
  can: twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.3 }, S_SHAPE),
  will: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: 0.35 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  should: twoFrame(S_SHAPE, FIST, { ...S_SHAPE, wristX: 0.3 }, FIST),
  must: twoFrame(X_SHAPE, FIST, { ...X_SHAPE, wristX: 0.3 }, FIST),
  would: twoFrame(W_SHAPE, FIST, { ...W_SHAPE, wristZ: 0.3 }, FIST),
  could: twoFrame(C_SHAPE, FIST, { ...C_SHAPE, wristX: 0.3 }, FIST),
  do: twoFrame(D_SHAPE, D_SHAPE, { ...D_SHAPE, wristZ: 0.3 }, { ...D_SHAPE, wristZ: -0.3 }),
  be: staticSign(FLAT_B, FIST),
  let: twoFrame(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristZ: 0.3 }, { ...L_SHAPE, wristZ: 0.3 }),

  // ── School / Learning ─────────────────────────────────────
  test: repeated(T_SHAPE, FIST, { ...T_SHAPE, wristZ: 0.2 }, FIST),
  class: twoFrame(C_SHAPE, C_SHAPE, { ...C_SHAPE, wristZ: 0.4 }, { ...C_SHAPE, wristZ: -0.4 }),
  grade: twoFrame(G_SHAPE, FIST, { ...G_SHAPE, wristX: 0.3 }, FIST),
  homework: repeated(H_SHAPE, FIST, { ...H_SHAPE, wristX: 0.2 }, FIST),
  math: twoFrame(M_SHAPE, FIST, { ...M_SHAPE, wristZ: 0.3 }, FIST),
  science: repeated(S_SHAPE, FIST, { ...S_SHAPE, wristZ: 0.25 }, FIST),
  question: animSign([
    { right: POINT_UP, left: FIST, face: QUESTION_FACE, holdMs: 280 },
    { right: X_SHAPE, left: FIST, face: QUESTION_FACE, holdMs: 420 },
  ]),
  example: twoFrame(E_SHAPE, FIST, { ...E_SHAPE, wristZ: 0.3 }, FIST),
  word: repeated(G_SHAPE, POINT_UP, { ...G_SHAPE, wristZ: 0.25 }, POINT_UP),
  meaning: twoFrame(F_SHAPE, FIST, { ...F_SHAPE, wristZ: 0.3 }, FIST),
  story: repeated(F_SHAPE, F_SHAPE, { ...F_SHAPE, wristZ: 0.3 }, { ...F_SHAPE, wristZ: -0.3 }),
  language: twoFrame(L_SHAPE, L_SHAPE, { ...L_SHAPE, wristZ: 0.4 }, { ...L_SHAPE, wristZ: -0.4 }),

  // ── Health ────────────────────────────────────────────────
  hurt: repeated(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: 0.3 }, { ...POINT_UP, wristZ: -0.3 }, SAD_FACE),
  pain: repeated(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: 0.3 }, { ...POINT_UP, wristZ: -0.3 }, SAD_FACE),
  sick: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.3 }, FIST, SAD_FACE),
  fever: twoFrame(CURVED, FIST, { ...CURVED, wristX: 0.3 }, FIST),
  headache: repeated(POINT_UP, FIST, { ...POINT_UP, wristX: 0.25 }, FIST, SAD_FACE),
  better: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristX: -0.3 }, FIST, HAPPY_FACE),
  worse: twoFrame(W_SHAPE, FIST, { ...W_SHAPE, wristX: 0.3 }, FIST, SAD_FACE),

  // ── Sports & Activities ───────────────────────────────────
  sport: repeated(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristZ: 0.3 }, { ...S_SHAPE, wristZ: -0.3 }),
  game: repeated(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristZ: 0.3 }, { ...A_SHAPE, wristZ: -0.3 }),
  team: repeated(T_SHAPE, FIST, { ...T_SHAPE, wristZ: 0.3 }, FIST),
  ball: twoFrame(CURVED, CURVED, { ...CURVED, wristY: 0.3 }, { ...CURVED, wristY: -0.3 }),
  music: repeated(OPEN5, CURVED, { ...OPEN5, wristZ: 0.3 }, CURVED),
  dance: repeated(V_SHAPE, FLAT_B, { ...V_SHAPE, wristZ: 0.3 }, FLAT_B, HAPPY_FACE),
  sing: repeated(OPEN5, FIST, { ...OPEN5, wristZ: 0.3 }, FIST),
  art: twoFrame(A_SHAPE, FLAT_B, { ...A_SHAPE, wristZ: 0.4 }, FLAT_B),
  draw: twoFrame(I_SHAPE, FLAT_B, { ...I_SHAPE, wristZ: 0.4 }, FLAT_B),
  paint: repeated(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.3 }, FLAT_B),
  photograph: twoFrame(L_SHAPE, CURVED, { ...L_SHAPE, wristX: 0.3 }, CURVED),

  // ── Numbers used conversationally ────────────────────────
  first: staticSign(POINT_UP, FIST),
  third:  staticSign({ thumb: { flex: 0.1, abd: 0.7 }, index: { curl: 0, spread: -0.2 }, middle: { curl: 0, spread: 0.2 }, ring: { curl: 0.9, spread: 0 }, pinky: { curl: 0.9, spread: 0 } }, FIST),
  last: twoFrame(L_SHAPE, POINT_UP, { ...L_SHAPE, wristX: 0.3 }, POINT_UP),

  // ── FEEL – critical verb (open-8 / bent-middle brushes up chest) ──
  feel: animSign([
    { right: atPos(FEEL_HP, AT_CHEST, 0.07), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(FEEL_HP, AT_CHEST + 0.07, 0.07), wristX: 0.10 }, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: atPos(FEEL_HP, AT_CHEST, 0.07), left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
  ]),

  // ── Greetings / Farewells not yet covered ────────────────
  'good morning': animSign([
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 260 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.06, 0.12), wristX: 0.22 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 280 },
    { right: FLAT_B, left: CURVED, face: HAPPY_FACE, holdMs: 260 },
    { right: { ...FLAT_B, wristX: -0.30 }, left: CURVED, face: HAPPY_FACE, holdMs: 380 },
  ]),
  'good afternoon': animSign([
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 260 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.06, 0.12), wristX: 0.22 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 280 },
    { right: FLAT_B, left: FLAT_B, face: HAPPY_FACE, holdMs: 260 },
    { right: { ...FLAT_B, wristX: 0.30 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 380 },
  ]),
  'good evening': animSign([
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 260 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.06, 0.12), wristX: 0.22 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 280 },
    { right: FLAT_B, left: CURVED, face: { ...HAPPY_FACE, eyeSquint: 0.1 }, holdMs: 260 },
    { right: { ...FLAT_B, wristX: 0.28 }, left: CURVED, face: { ...HAPPY_FACE, eyeSquint: 0.1 }, holdMs: 380 },
  ]),
  'good night': animSign([
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.06, 0.12), wristX: 0.22 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 260 },
    { right: FLAT_B, left: CURVED, face: { ...NEUTRAL_FACE, eyeSquint: 0.3 }, holdMs: 260 },
    { right: { ...FLAT_B, wristX: -0.30 }, left: CURVED, face: { ...NEUTRAL_FACE, eyeSquint: 0.3 }, holdMs: 400 },
  ]),
  goodnight: animSign([
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.06, 0.12), wristX: 0.22 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 260 },
    { right: FLAT_B, left: CURVED, face: { ...NEUTRAL_FACE, eyeSquint: 0.3 }, holdMs: 260 },
    { right: { ...FLAT_B, wristX: -0.30 }, left: CURVED, face: { ...NEUTRAL_FACE, eyeSquint: 0.3 }, holdMs: 400 },
  ]),
  'see you': animSign([
    { right: V_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: 0.18 }, left: FIST, face: HAPPY_FACE, holdMs: 440 },
  ]),
  'see you later': animSign([
    { right: V_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: { ...POINT_UP, wristZ: 0.18 }, left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: L_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: { ...L_SHAPE, wristZ: 0.35 }, left: FIST, face: HAPPY_FACE, holdMs: 360 },
  ]),
  'good luck': animSign([
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.06, 0.12), wristX: 0.22 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 260 },
    { right: L_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: { ...L_SHAPE, wristX: -0.20 }, left: FIST, face: HAPPY_FACE, holdMs: 380 },
  ]),

  // ── Quantifiers / Determiners (critical gap) ─────────────
  // ALL: flat hand sweeps across curved palm, closes
  all: animSign([
    { right: FLAT_B, left: CURVED, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: -0.45 }, left: CURVED, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  // BOTH: V-hand draws together into bent-V
  both: animSign([
    { right: V_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: CURVED, left: FIST, face: NEUTRAL_FACE, holdMs: 440 },
  ]),
  some: twoFrame(A_SHAPE, FLAT_B, { ...A_SHAPE, wristZ: 0.30 }, FLAT_B),
  any:  twoFrame(A_SHAPE, FIST,   { ...A_SHAPE, wristZ: 0.30 }, FIST),
  every: repeated(A_SHAPE, POINT_UP, { ...A_SHAPE, wristX: 0.22 }, POINT_UP),
  each:  repeated(A_SHAPE, POINT_UP, { ...A_SHAPE, wristX: 0.22 }, POINT_UP),
  many: animSign([
    { right: S_SHAPE, left: S_SHAPE, face: NEUTRAL_FACE, holdMs: 240 },
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  much: animSign([
    { right: CURVED, left: CURVED, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...CURVED, wristX: -0.30 }, left: { ...CURVED, wristX: 0.30 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  most: twoFrame(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristX: -0.30 }, A_SHAPE),
  other:   twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ: -0.30 }, FIST),
  another: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ:  0.30 }, FIST),
  several: repeated(
    { thumb: { flex: 0.8, abd: 0 }, index: { curl: 0, spread: -0.28 }, middle: { curl: 0, spread: -0.08 }, ring: { curl: 0, spread: 0.08 }, pinky: { curl: 0, spread: 0.28 } },
    FIST,
    { thumb: { flex: 0.8, abd: 0 }, index: { curl: 0, spread: -0.28 }, middle: { curl: 0, spread: -0.08 }, ring: { curl: 0, spread: 0.08 }, pinky: { curl: 0, spread: 0.28 }, wristY: 0.20 },
    FIST,
  ),
  few: twoFrame(
    { thumb: { flex: 0.8, abd: 0 }, index: { curl: 0, spread: -0.28 }, middle: { curl: 0, spread: -0.08 }, ring: { curl: 0, spread: 0.08 }, pinky: { curl: 0, spread: 0.28 } },
    FIST,
    FIST, FIST,
  ),
  everything: twoFrame(E_SHAPE, FIST, { ...E_SHAPE, wristZ: 0.35 }, FIST),
  nothing: animSign([
    { right: O_SHAPE, left: O_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...O_SHAPE, wristZ: 0.30 }, left: { ...O_SHAPE, wristZ: -0.30 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  something:  staticSign(S_SHAPE, FIST),
  anything:   twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ: 0.30 }, FIST),
  everyone:   repeated(E_SHAPE, FIST, { ...E_SHAPE, wristY: 0.25 }, FIST),
  everybody:  repeated(E_SHAPE, FIST, { ...E_SHAPE, wristY: 0.25 }, FIST),
  nobody:     twoFrame(O_SHAPE, FIST, { ...O_SHAPE, wristZ: 0.35 }, FIST),
  nowhere:    twoFrame(O_SHAPE, FIST, { ...O_SHAPE, wristZ: 0.35 }, FIST),
  'a lot':   animSign([
    { right: S_SHAPE, left: S_SHAPE, face: NEUTRAL_FACE, holdMs: 240 },
    { right: OPEN5,   left: OPEN5,   face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  'a little': twoFrame(G_SHAPE, G_SHAPE, { ...G_SHAPE, wristY: 0.25 }, { ...G_SHAPE, wristY: -0.25 }),
  lots: animSign([
    { right: S_SHAPE, left: S_SHAPE, face: NEUTRAL_FACE, holdMs: 240 },
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 420 },
  ]),

  // ── Core Social / Conversational Verbs ───────────────────
  // MISS: index curls under chin and slides forward (longing)
  miss: animSign([
    { right: atPos(POINT_UP, AT_CHIN, 0.03, +0.03), left: FIST, face: SAD_FACE, holdMs: 280 },
    { right: { ...atPos(POINT_UP, AT_CHIN, 0.03, +0.03), wristX: 0.22 }, left: FIST, face: SAD_FACE, holdMs: 420 },
  ]),
  hate: animSign([
    { right: { ...D_SHAPE, posX: +0.06, posZ: 0.06 }, left: { ...D_SHAPE, posX: -0.06, posZ: 0.06 }, face: { ...ANGRY_FACE, eyebrowRaise: -0.4 }, holdMs: 280 },
    { right: { ...D_SHAPE, posX: +0.14, posZ: 0.06, wristZ:  0.30 }, left: { ...D_SHAPE, posX: -0.14, posZ: 0.06, wristZ: -0.30 }, face: { ...ANGRY_FACE, eyebrowRaise: -0.4 }, holdMs: 420 },
  ]),
  dislike: animSign([
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.2 }, holdMs: 280 },
    { right: { ...POINT_UP, wristZ: -0.40 }, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.2 }, holdMs: 420 },
  ]),
  enjoy: animSign([
    { right: FLAT_B, left: FLAT_B, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ: 0.28 }, left: { ...FLAT_B, wristZ: -0.28 }, face: HAPPY_FACE, holdMs: 420 },
  ]),
  // WISH: W-hand circular motion on chest
  wish: animSign([
    { right: atPos(W_SHAPE, AT_CHEST, 0.06), left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.2 }, holdMs: 280 },
    { right: { ...atPos(W_SHAPE, AT_CHEST + 0.05, 0.06), wristX: 0.18 }, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.2 }, holdMs: 420 },
  ]),
  // WONDER: W/circular at temple
  wonder: animSign([
    { right: atPos(W_SHAPE, AT_TEMPLE, 0.01, +0.07), left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.3 }, holdMs: 260 },
    { right: { ...atPos(W_SHAPE, AT_TEMPLE, 0.01, +0.07), wristZ: 0.25 }, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.3 }, holdMs: 260 },
    { right: atPos(W_SHAPE, AT_TEMPLE, 0.01, +0.07), left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.3 }, holdMs: 260 },
  ]),
  // AGREE: index at temple, then both hands point together
  agree: animSign([
    { right: atPos(POINT_UP, AT_TEMPLE, 0.01, +0.06), left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: { ...POINT_UP, posX: +0.06 }, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 440 },
  ]),
  disagree: animSign([
    { right: { ...POINT_UP, posX: +0.06 }, left: POINT_UP, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.2 }, holdMs: 280 },
    { right: { ...POINT_UP, posX: +0.06, wristZ: -0.35 }, left: POINT_UP, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.2 }, holdMs: 420 },
  ]),
  // EXPLAIN: flat hands alternately brush forward from body
  explain: animSign([
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristZ:  0.30 }, left: { ...FLAT_B, wristZ: -0.30 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: FLAT_B, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  // MEAN (verb): V-hand twists on open palm → "what it means"
  mean: animSign([
    { right: V_SHAPE, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...V_SHAPE, wristX: 0.35 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  matter: repeated(M_SHAPE, FIST, { ...M_SHAPE, wristZ: 0.20 }, FIST),
  care:   repeated(K_SHAPE, FIST, { ...K_SHAPE, wristZ: 0.20 }, FIST),
  // MIND: M-hand taps forehead
  mind: animSign([
    { right: atPos(M_SHAPE, AT_TEMPLE, 0.01, +0.06), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(M_SHAPE, AT_TEMPLE, 0.01, +0.06), wristZ: 0.14 }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  opinion: twoFrame(O_SHAPE, FIST, { ...O_SHAPE, wristZ: 0.30 }, FIST),
  // REPEAT: R hand circles back to palm (common clarification sign)
  repeat: animSign([
    { right: CURVED, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: -0.25 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  'please repeat': animSign([
    { right: atPos(FLAT_B, AT_CHEST, 0.07), left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.3 }, holdMs: 280 },
    { right: { ...atPos(FLAT_B, AT_CHEST, 0.07), wristZ: 0.30 }, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.3 }, holdMs: 240 },
    { right: CURVED, left: FLAT_B, face: { ...NEUTRAL_FACE, mouthSmile: 0.3 }, holdMs: 240 },
    { right: { ...FLAT_B, wristX: -0.25 }, left: FLAT_B, face: { ...NEUTRAL_FACE, mouthSmile: 0.3 }, holdMs: 360 },
  ]),
  'slow down': animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.20 }, left: FIST, face: NEUTRAL_FACE, holdMs: 560 },
  ]),
  slower: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.20 }, left: FIST, face: NEUTRAL_FACE, holdMs: 560 },
  ]),

  // ── Key Action Verbs (gap-fill) ───────────────────────────
  happen: animSign([
    { right: POINT_UP, left: POINT_UP, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, wristX: 0.40 }, left: { ...POINT_UP, wristX: 0.40 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  stay:    staticSign(Y_SHAPE, FIST, NEUTRAL_FACE, 700),
  hold:    twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.20 }, S_SHAPE),
  follow:  twoFrame(A_SHAPE, A_SHAPE, { ...A_SHAPE, wristZ: 0.30 }, { ...A_SHAPE, wristZ: 0.30 }),
  join:    twoFrame(CURVED, CURVED, { ...CURVED, wristZ: 0.30 }, { ...CURVED, wristZ: -0.30 }),
  fix:     repeated(X_SHAPE, FIST, { ...X_SHAPE, wristZ: 0.22 }, FIST),
  break:   animSign([
    { right: S_SHAPE, left: S_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...S_SHAPE, wristZ:  0.50 }, left: { ...S_SHAPE, wristZ: -0.50 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  catch:   twoFrame(OPEN5, FIST, FIST, FIST),
  turn:    repeated(T_SHAPE, FIST, { ...T_SHAPE, wristY: 0.50 }, FIST),
  fall:    animSign([
    { right: V_SHAPE, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...V_SHAPE, wristX: 0.40 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  include: twoFrame(FLAT_O, FLAT_B, { ...FLAT_O, wristX: -0.30 }, FLAT_B),
  exclude: twoFrame(FLAT_O, FLAT_B, { ...FLAT_O, wristX:  0.30 }, FLAT_B),
  compare: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: -0.30 }, FLAT_B),
  accept:  twoFrame(OPEN5, OPEN5, FIST, FIST),
  invite:  twoFrame(FLAT_B, FIST, { ...FLAT_B, wristX: -0.25 }, FIST),
  introduce: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.30 }, { ...FLAT_B, wristZ: -0.30 }),
  describe: animSign([
    { right: D_SHAPE, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...D_SHAPE, wristZ:  0.30 }, left: { ...D_SHAPE, wristZ: -0.30 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: D_SHAPE, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
  ]),
  check: repeated(X_SHAPE, FLAT_B, { ...X_SHAPE, wristX: 0.22 }, FLAT_B),
  pass:  twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristY: 0.35 }, FLAT_B),

  // ── Senses (missing) ─────────────────────────────────────
  // SMELL: A-hand sweeps up from nose area
  smell: animSign([
    { right: atPos(A_SHAPE, AT_NOSE, 0.02), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(A_SHAPE, AT_NOSE + 0.05, 0.03), wristX: -0.15 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  // TOUCH: bent middle finger touches back of other hand
  touch: twoFrame(FEEL_HP, FLAT_B, { ...FEEL_HP, wristX: 0.22 }, FLAT_B),
  // TASTE: bent middle finger taps lip
  taste: animSign([
    { right: atPos(FEEL_HP, AT_MOUTH, 0.02), left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.2 }, holdMs: 280 },
    { right: { ...atPos(FEEL_HP, AT_MOUTH, 0.02), wristX: 0.15 }, left: FIST, face: { ...NEUTRAL_FACE, mouthOpen: 0.2 }, holdMs: 420 },
  ]),

  // ── Important Nouns (missing) ─────────────────────────────
  // IDEA: I-hand flicks outward from forehead (like a light bulb)
  idea: animSign([
    { right: atPos(I_SHAPE, AT_FOREHEAD, 0.01, +0.05), left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.4 }, holdMs: 280 },
    { right: { ...I_SHAPE, wristX: -0.22, posX: +0.08, posY: AT_FOREHEAD + 0.04, posZ: 0.05 }, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.4 }, holdMs: 440 },
  ]),
  // PROBLEM: bent-V hands twist together
  problem: animSign([
    { right: { ...V_SHAPE, posX: +0.06 }, left: { ...V_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...V_SHAPE, posX: +0.06, wristX: 0.30 }, left: { ...V_SHAPE, posX: -0.06, wristX: 0.30 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  trouble: animSign([
    { right: { ...V_SHAPE, posX: +0.06 }, left: { ...V_SHAPE, posX: -0.06 }, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.2 }, holdMs: 280 },
    { right: { ...V_SHAPE, posX: +0.06, wristX: 0.30 }, left: { ...V_SHAPE, posX: -0.06, wristX: 0.30 }, face: { ...NEUTRAL_FACE, eyebrowRaise: -0.2 }, holdMs: 420 },
  ]),
  thing:  twoFrame(T_SHAPE, FIST, { ...T_SHAPE, wristZ: 0.30 }, FIST),
  things: twoFrame(T_SHAPE, FIST, { ...T_SHAPE, wristZ: 0.30 }, FIST),
  // PLACE: P-hands make a circle and return (like tracing a space)
  place: animSign([
    { right: FINGERSPELLING.P, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...FINGERSPELLING.P, wristZ: 0.50 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  // WAY / PATH: W-hands sweep forward together
  way:  twoFrame(W_SHAPE, W_SHAPE, { ...W_SHAPE, wristZ: 0.30 }, { ...W_SHAPE, wristZ: 0.30 }),
  path: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.35 }, { ...FLAT_B, wristZ: 0.35 }),
  // LIFE: L-hands brush up sides of body (from waist)
  life: animSign([
    { right: L_SHAPE, left: L_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...L_SHAPE, wristX: -0.30 }, left: { ...L_SHAPE, wristX: -0.30 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  // REASON: R-hand circles at temple then moves outward
  reason: animSign([
    { right: atPos(R_SHAPE, AT_TEMPLE, 0.01, +0.07), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...R_SHAPE, wristZ: 0.30 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  plan:    twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.35 }, { ...FLAT_B, wristZ: 0.35 }),
  goal:    repeated(G_SHAPE, FIST, { ...G_SHAPE, wristZ: 0.30 }, FIST),
  purpose: twoFrame(FINGERSPELLING.P, FIST, { ...FINGERSPELLING.P, wristZ: 0.30 }, FIST),
  // GROUP: C-hands circle forward and outward
  group: animSign([
    { right: C_SHAPE, left: C_SHAPE, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...C_SHAPE, wristZ:  0.45 }, left: { ...C_SHAPE, wristZ: -0.45 }, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  // AGE: A-hand strokes down from chin (chin-to-chest)
  age: animSign([
    { right: atPos(A_SHAPE, AT_CHIN, 0.03, +0.03), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(A_SHAPE, AT_JAW, 0.04, +0.03), wristX: 0.20 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  'how old': animSign([
    { right: CURVED, left: CURVED, face: WH_QUESTION_FACE, holdMs: 260 },
    { right: FLAT_B, left: FLAT_B, face: WH_QUESTION_FACE, holdMs: 260 },
    { right: atPos(A_SHAPE, AT_CHIN, 0.03, +0.03), left: FIST, face: WH_QUESTION_FACE, holdMs: 360 },
  ]),
  birthday: animSign([
    { right: atPos(FEEL_HP, AT_MOUTH, 0.02, +0.02), left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: { ...atPos(FEEL_HP, AT_MOUTH, 0.02, +0.02), wristX: 0.14 }, left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: OPEN5, left: OPEN5, face: HAPPY_FACE, holdMs: 380 },
  ]),
  job:   repeated(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: 0.20 }, S_SHAPE),
  hobby: repeated(H_SHAPE, FIST,    { ...H_SHAPE, wristZ: 0.25 }, FIST),
  sense: animSign([
    { right: atPos(FEEL_HP, AT_CHEST, 0.07), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(FEEL_HP, AT_CHEST + 0.05, 0.07), wristX: 0.10 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  couple: animSign([
    { right: CURVED, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: CURVED, left: CURVED, face: NEUTRAL_FACE, holdMs: 440 },
  ]),
  adult: twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristX: 0.22 }, FIST),

  // ── Time / Scheduling (gap-fill) ─────────────────────────
  weekend: animSign([
    { right: W_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...W_SHAPE, wristZ: 0.35 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  holiday: animSign([
    { right: H_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...H_SHAPE, wristZ: 0.30 }, left: FIST, face: HAPPY_FACE, holdMs: 420 },
  ]),
  vacation: animSign([
    { right: V_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...V_SHAPE, wristX: -0.22 }, left: FIST, face: HAPPY_FACE, holdMs: 420 },
  ]),
  appointment: animSign([
    { right: A_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...A_SHAPE, wristZ: 0.30 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  schedule: repeated(S_SHAPE, FLAT_B, { ...S_SHAPE, wristZ: 0.25 }, FLAT_B),
  'what time': animSign([
    { right: FLAT_B, left: FIST, face: WH_QUESTION_FACE, holdMs: 260 },
    { right: { ...FLAT_B, wristX: 0.20 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 260 },
    { right: POINT_UP, left: FIST, face: WH_QUESTION_FACE, holdMs: 380 },
  ]),
  'right now': repeated(Y_SHAPE, Y_SHAPE, { ...Y_SHAPE, wristX: 0.22 }, { ...Y_SHAPE, wristX: 0.22 }),

  // ── Adjectives (gap-fill) ─────────────────────────────────
  // NICE: standalone (flat hand brushes over other flat hand)
  nice: twoFrame(FLAT_B, FLAT_B, { ...FLAT_B, wristZ: 0.30 }, FLAT_B, HAPPY_FACE),
  // SMART: index at temple, flicks forward and up
  smart: animSign([
    { right: atPos(POINT_UP, AT_TEMPLE, 0.01, +0.06), left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.2 }, holdMs: 280 },
    { right: { ...POINT_UP, wristX: -0.22, posX: +0.10, posY: AT_TEMPLE + 0.03, posZ: 0.04 }, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.2 }, holdMs: 440 },
  ]),
  stupid: animSign([
    { right: atPos(S_SHAPE, AT_FOREHEAD, 0.01, +0.04), left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: -0.2 }, holdMs: 280 },
    { right: { ...atPos(S_SHAPE, AT_FOREHEAD, 0.01, +0.04), wristX: 0.20 }, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: -0.2 }, holdMs: 420 },
  ]),
  // CRAZY: claw at temple, small circles
  crazy: animSign([
    { right: atPos(CLAW, AT_TEMPLE, 0.01, +0.07), left: FIST, face: SURPRISED_FACE, holdMs: 260 },
    { right: { ...atPos(CLAW, AT_TEMPLE, 0.01, +0.07), wristZ: 0.30 }, left: FIST, face: SURPRISED_FACE, holdMs: 260 },
    { right: atPos(CLAW, AT_TEMPLE, 0.01, +0.07), left: FIST, face: SURPRISED_FACE, holdMs: 260 },
  ]),
  strange: animSign([
    { right: C_SHAPE, left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...C_SHAPE, wristZ: -0.40 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 420 },
  ]),
  weird: animSign([
    { right: C_SHAPE, left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...C_SHAPE, wristZ: -0.40 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 420 },
  ]),
  interesting: animSign([
    { right: CURVED, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.3 }, holdMs: 280 },
    { right: { ...CURVED, wristX: -0.20 }, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.3 }, holdMs: 420 },
  ]),
  boring: animSign([
    { right: atPos(POINT_UP, AT_NOSE, 0.01), left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: -0.3, eyeSquint: 0.2 }, holdMs: 280 },
    { right: { ...atPos(POINT_UP, AT_NOSE, 0.01), wristZ: -0.30 }, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: -0.3, eyeSquint: 0.2 }, holdMs: 420 },
  ]),
  serious: animSign([
    { right: atPos(S_SHAPE, AT_CHIN, 0.03, +0.03), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(S_SHAPE, AT_CHIN, 0.03, +0.03), wristZ: 0.20 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  kind:    repeated(K_SHAPE, FLAT_B, { ...K_SHAPE, wristZ: 0.25 }, FLAT_B, HAPPY_FACE),
  honest:  animSign([
    { right: H_SHAPE, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...H_SHAPE, wristZ: 0.30 }, left: FLAT_B, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  polite:  repeated(FINGERSPELLING.P, FLAT_B, { ...FINGERSPELLING.P, wristX: 0.20 }, FLAT_B, HAPPY_FACE),
  strong:  twoFrame(S_SHAPE, FIST, { ...S_SHAPE, wristX: -0.25 }, FIST),
  weak:    twoFrame(W_SHAPE, FIST, { ...W_SHAPE, wristX:  0.20 }, FIST),
  brave:   twoFrame(S_SHAPE, S_SHAPE, { ...S_SHAPE, wristX: -0.30 }, S_SHAPE),
  // SWEET: U-fingers brush down chin
  sweet: animSign([
    { right: atPos(U_SHAPE, AT_CHIN, 0.02, +0.03), left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...atPos(U_SHAPE, AT_JAW, 0.03, +0.03), wristX: 0.18 }, left: FIST, face: HAPPY_FACE, holdMs: 420 },
  ]),
  lucky:   repeated(L_SHAPE, FIST, { ...L_SHAPE, wristX: -0.20 }, FIST, HAPPY_FACE),
  // DEFINITELY: flat B-hand firm downward motion
  definitely: animSign([
    { right: FLAT_B, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.1 }, holdMs: 280 },
    { right: { ...FLAT_B, wristX: 0.30 }, left: FIST, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.1 }, holdMs: 420 },
  ]),
  exactly: twoFrame(X_SHAPE, FIST, { ...X_SHAPE, wristX: 0.28 }, FIST, { ...NEUTRAL_FACE, eyebrowRaise: 0.1 }),
  finally: animSign([
    { right: F_SHAPE, left: F_SHAPE, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.2 }, holdMs: 280 },
    { right: { ...F_SHAPE, wristZ:  0.35 }, left: { ...F_SHAPE, wristZ: -0.35 }, face: { ...NEUTRAL_FACE, eyebrowRaise: 0.2 }, holdMs: 420 },
  ]),
  therefore: twoFrame(T_SHAPE, FIST, { ...T_SHAPE, wristZ: 0.30 }, FIST),

  // ── Personal / Relationship Info (gap-fill) ───────────────
  married: animSign([
    { right: CURVED, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: CURVED, left: CURVED, face: NEUTRAL_FACE, holdMs: 440 },
  ]),
  single: animSign([
    { right: S_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: { ...S_SHAPE, wristZ: 0.35 }, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
    { right: S_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 260 },
  ]),
  boyfriend: animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: { ...FLAT_B, wristX: 0.22 }, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: CURVED, left: CURVED, face: NEUTRAL_FACE, holdMs: 380 },
  ]),
  girlfriend: animSign([
    { right: A_SHAPE, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: { ...A_SHAPE, wristX: -0.22 }, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: CURVED, left: CURVED, face: NEUTRAL_FACE, holdMs: 380 },
  ]),
  cousin: repeated(C_SHAPE, FIST, { ...C_SHAPE, wristZ: 0.30 }, FIST),
  aunt:   twoFrame(A_SHAPE, FIST, { ...A_SHAPE, wristZ: -0.30 }, FIST),
  uncle:  repeated(U_SHAPE, FIST, { ...U_SHAPE, wristZ: 0.25 }, FIST),
  relative: repeated(R_SHAPE, FIST, { ...R_SHAPE, wristZ: 0.28 }, FIST),
  partner:  twoFrame(CURVED, CURVED, { ...CURVED, wristZ: 0.35 }, { ...CURVED, wristZ: -0.35 }),

  // ── Common Conversational Phrases (gap-fill) ──────────────
  'never mind': animSign([
    { right: OPEN5, left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...OPEN5, wristZ: -0.50 }, left: FIST, face: NEUTRAL_FACE, holdMs: 420 },
  ]),
  'of course': animSign([
    { right: S_SHAPE, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.2 }, holdMs: 280 },
    { right: { ...S_SHAPE, wristZ: 0.35 }, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.2 }, holdMs: 420 },
  ]),
  'no problem': animSign([
    { right: FINGERSPELLING.N, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: FINGERSPELLING.O, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: { ...V_SHAPE, posX: +0.06 }, left: { ...V_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...V_SHAPE, posX: +0.06, wristX: 0.30 }, left: { ...V_SHAPE, posX: -0.06, wristX: 0.30 }, face: NEUTRAL_FACE, holdMs: 360 },
  ]),
  'i understand': animSign([
    { right: POINT_UP, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: atPos(POINT_UP, AT_FOREHEAD, 0.01, +0.04), left: FIST, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...atPos(POINT_UP, AT_FOREHEAD, 0.01, +0.04), wristX: 0.30 }, left: FIST, face: NEUTRAL_FACE, holdMs: 380 },
  ]),
  "i don't understand": animSign([
    { right: POINT_UP, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: atPos(POINT_UP, AT_FOREHEAD, 0.01, +0.04), left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...atPos(POINT_UP, AT_FOREHEAD, 0.01, +0.04), wristZ: -0.40 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 400 },
  ]),
  "don't understand": animSign([
    { right: atPos(POINT_UP, AT_FOREHEAD, 0.01, +0.04), left: FIST, face: WH_QUESTION_FACE, holdMs: 280 },
    { right: { ...atPos(POINT_UP, AT_FOREHEAD, 0.01, +0.04), wristZ: -0.40 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 420 },
  ]),
  'wait a moment': animSign([
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...OPEN5, wristZ: 0.15 }, left: { ...OPEN5, wristZ: -0.15 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...POINT_UP, thumb: { flex: 0.72, abd: 0 } }, left: FIST, face: NEUTRAL_FACE, holdMs: 400 },
  ]),
  'hold on': animSign([
    { right: OPEN5, left: OPEN5, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...OPEN5, wristZ: 0.15 }, left: { ...OPEN5, wristZ: -0.15 }, face: NEUTRAL_FACE, holdMs: 440 },
  ]),
  'what do you mean': animSign([
    { right: FLAT_B, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: { ...FLAT_B, wristX: 0.20 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: { ...POINT_UP, wristZ: 0.18 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: V_SHAPE, left: FLAT_B, face: WH_QUESTION_FACE, holdMs: 360 },
  ]),
  'i miss you': animSign([
    { right: POINT_UP, left: FIST, face: SAD_FACE, holdMs: 240 },
    { right: atPos(POINT_UP, AT_CHIN, 0.03, +0.03), left: FIST, face: SAD_FACE, holdMs: 280 },
    { right: { ...atPos(POINT_UP, AT_CHIN, 0.03, +0.03), wristX: 0.22 }, left: FIST, face: SAD_FACE, holdMs: 240 },
    { right: { ...POINT_UP, wristZ: 0.18 }, left: FIST, face: SAD_FACE, holdMs: 380 },
  ]),
  "that's fine": animSign([
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.2 }, holdMs: 280 },
    { right: F_SHAPE, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.2 }, holdMs: 420 },
  ]),
  'that is okay': animSign([
    { right: O_SHAPE, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.2 }, holdMs: 300 },
    { right: POINT_UP, left: FIST, face: { ...NEUTRAL_FACE, mouthSmile: 0.2 }, holdMs: 420 },
  ]),
  "i'm fine": animSign([
    { right: POINT_UP, left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: F_SHAPE, left: FIST, face: HAPPY_FACE, holdMs: 420 },
  ]),
  "i'm good": animSign([
    { right: POINT_UP, left: FIST, face: HAPPY_FACE, holdMs: 240 },
    { right: atPos(FLAT_B, AT_CHIN, 0.02, +0.04), left: FIST, face: HAPPY_FACE, holdMs: 280 },
    { right: { ...atPos(FLAT_B, AT_CHIN - 0.06, 0.12), wristX: 0.22 }, left: FLAT_B, face: HAPPY_FACE, holdMs: 380 },
  ]),
  "what's your name": animSign([
    { right: FLAT_B, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: { ...FLAT_B, wristX: 0.20 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: { ...FLAT_B, wristZ: 0.20 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: { ...H_SHAPE, posX: +0.06 }, left: { ...H_SHAPE, posX: -0.06 }, face: WH_QUESTION_FACE, holdMs: 360 },
  ]),
  'my name is': animSign([
    { right: FLAT_B, left: FIST, face: NEUTRAL_FACE, holdMs: 240 },
    { right: { ...H_SHAPE, posX: +0.06 }, left: { ...H_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 280 },
    { right: { ...H_SHAPE, posX: +0.06, wristX: 0.22 }, left: { ...H_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 260 },
    { right: { ...H_SHAPE, posX: +0.06 }, left: { ...H_SHAPE, posX: -0.06 }, face: NEUTRAL_FACE, holdMs: 260 },
  ]),
  'where are you from': animSign([
    { right: POINT_UP, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: { ...POINT_UP, wristZ: 0.28 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: { ...POINT_UP, wristZ: 0.18 }, left: FIST, face: WH_QUESTION_FACE, holdMs: 240 },
    { right: FINGERSPELLING.F, left: FIST, face: WH_QUESTION_FACE, holdMs: 360 },
  ]),

  // ── Additional Common Words ───────────────────────────────
  fine:    twoFrame(F_SHAPE, FIST, { ...F_SHAPE, wristX: 0.22 }, FIST, HAPPY_FACE),
  from:    twoFrame(FINGERSPELLING.F, FIST, { ...FINGERSPELLING.F, wristZ: 0.30 }, FIST),
  since:   twoFrame(POINT_UP, FIST, { ...POINT_UP, wristZ: -0.30 }, FIST),
  until:   twoFrame(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: 0.30 }, POINT_UP),
  during:  twoFrame(D_SHAPE, FIST, { ...D_SHAPE, wristZ: 0.30 }, FIST),
  while:   twoFrame(Y_SHAPE, Y_SHAPE, { ...Y_SHAPE, wristZ: 0.25 }, { ...Y_SHAPE, wristZ: 0.25 }),
  type:    repeated(T_SHAPE, FIST, { ...T_SHAPE, wristZ: 0.22 }, FIST),
  sort:    twoFrame(S_SHAPE, FIST, { ...S_SHAPE, wristZ: 0.28 }, FIST),
  part:    twoFrame(FINGERSPELLING.P, FIST, { ...FINGERSPELLING.P, wristZ: 0.30 }, FIST),
  through: twoFrame(FLAT_B, V_SHAPE, { ...FLAT_B, wristY: 0.35 }, V_SHAPE),
  along:   twoFrame(POINT_UP, POINT_UP, { ...POINT_UP, wristZ: 0.35 }, POINT_UP),
  against: twoFrame(POINT_UP, FLAT_B, { ...POINT_UP, wristX: 0.30 }, FLAT_B),
  number:  repeated(FINGERSPELLING.N, FIST, { ...FINGERSPELLING.N, wristZ: 0.22 }, FIST),
  percent: twoFrame(O_SHAPE, FIST, { ...O_SHAPE, wristZ: 0.40 }, FIST),
  dollar:  repeated(D_SHAPE, FIST, { ...D_SHAPE, wristZ: 0.25 }, FIST),
  price:   twoFrame(X_SHAPE, FLAT_B, { ...X_SHAPE, wristX: 0.28 }, FLAT_B),
  total:   twoFrame(T_SHAPE, FIST, { ...T_SHAPE, wristX: 0.30 }, FIST),
  half:    twoFrame(H_SHAPE, FLAT_B, { ...H_SHAPE, wristZ: 0.30 }, FLAT_B),
  however: twoFrame(H_SHAPE, FIST, { ...H_SHAPE, wristZ: -0.30 }, FIST),

};

// ============================================================
// Irregular verb / word normalization map
// ============================================================
const IRREGULAR: Record<string, string> = {
  // to be
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be',
  // to go
  went: 'go', gone: 'go', going: 'go', goes: 'go',
  // to come
  came: 'come', comes: 'come', coming: 'come',
  // to do
  did: 'do', does: 'do', done: 'do', doing: 'do',
  // to have
  had: 'have', has: 'have', having: 'have',
  // to say
  said: 'say', says: 'say', saying: 'say',
  // to see
  saw: 'see', seen: 'see', seeing: 'see', sees: 'see',
  // to know
  knew: 'know', known: 'know', knowing: 'know', knows: 'know',
  // to think
  thought: 'think', thinks: 'think', thinking: 'think',
  // to make
  made: 'make', makes: 'make', making: 'make',
  // to take
  took: 'take', taken: 'take', taking: 'take', takes: 'take',
  // to come
  got: 'get', gotten: 'get', gets: 'get', getting: 'get',
  // to give
  gave: 'give', given: 'give', gives: 'give', giving: 'give',
  // to find
  found: 'find', finds: 'find', finding: 'find',
  // to keep
  kept: 'keep', keeps: 'keep', keeping: 'keep',
  // to feel
  felt: 'feel', feels: 'feel', feeling: 'feel',
  // to leave
  left: 'leave', leaves: 'leave', leaving: 'leave',
  // to run
  ran: 'run', runs: 'run', running: 'run',
  // to drive
  drove: 'drive', driven: 'drive', drives: 'drive', driving: 'drive',
  // to write
  wrote: 'write', written: 'write', writes: 'write', writing: 'write',
  // to read
  reading: 'read', reads: 'read',
  // to sit
  sat: 'sit', sits: 'sit', sitting: 'sit',
  // to stand
  stood: 'stand', stands: 'stand', standing: 'stand',
  // to eat
  ate: 'eat', eaten: 'eat', eats: 'eat', eating: 'eat',
  // to drink
  drank: 'drink', drunk: 'drink', drinks: 'drink', drinking: 'drink',
  // to sleep
  slept: 'sleep', sleeps: 'sleep', sleeping: 'sleep',
  // to buy
  bought: 'buy', buys: 'buy', buying: 'buy',
  // to bring
  brought: 'bring', brings: 'bring', bringing: 'bring',
  // to teach
  taught: 'teach', teaches: 'teach', teaching: 'teach',
  // to learn
  learnt: 'learn', learns: 'learn', learning: 'learn',
  // contractions
  "i'm":  'i',
  "it's": 'it',
  "he's": 'he',
  "she's": 'she',
  "we're": 'we',
  "they're": 'they',
  "i've": 'i',
  "i'll": 'i',
  "we'll": 'we',
  "they'll": 'they',
  "he'll": 'he',
  "she'll": 'she',
  "isn't": 'not',
  "aren't": 'not',
  "wasn't": 'not',
  "weren't": 'not',
  "haven't": 'not',
  "hasn't": 'not',
  "hadn't": 'not',
  "can't": "can't",
  "couldn't": 'can',
  "won't": "won't",
  "wouldn't": 'would',
  "shouldn't": 'should',
  "don't": "don't",
  "doesn't": 'not',
  "didn't": 'not',
  // to catch
  caught: 'catch', catches: 'catch', catching: 'catch',
  // to break
  broke: 'break', broken: 'break', breaks: 'break', breaking: 'break',
  // to fall
  fell: 'fall', fallen: 'fall', falls: 'fall', falling: 'fall',
  // to hold
  held: 'hold', holds: 'hold', holding: 'hold',
  // to mean
  meant: 'mean', means: 'mean', meaning: 'mean',
  // to agree
  agreed: 'agree', agrees: 'agree', agreeing: 'agree',
  // to disagree
  disagreed: 'disagree', disagrees: 'disagree',
  // to miss
  missed: 'miss', misses: 'miss', missing: 'miss',
  // to hate
  hated: 'hate', hates: 'hate', hating: 'hate',
  // to enjoy
  enjoyed: 'enjoy', enjoys: 'enjoy', enjoying: 'enjoy',
  // to wish
  wished: 'wish', wishes: 'wish', wishing: 'wish',
  // to explain
  explained: 'explain', explains: 'explain', explaining: 'explain',
  // to follow
  followed: 'follow', follows: 'follow', following: 'follow',
  // to accept
  accepted: 'accept', accepts: 'accept', accepting: 'accept',
  // to describe
  described: 'describe', describes: 'describe', describing: 'describe',
  // to compare
  compared: 'compare', compares: 'compare', comparing: 'compare',
  // to stay
  stayed: 'stay', stays: 'stay', staying: 'stay',
  // to happen
  happened: 'happen', happens: 'happen', happening: 'happen',
  // to include
  included: 'include', includes: 'include', including: 'include',
  // to join
  joined: 'join', joins: 'join', joining: 'join',
  // to taste
  tasted: 'taste', tastes: 'taste', tasting: 'taste',
  // to wonder
  wondered: 'wonder', wonders: 'wonder', wondering: 'wonder',
  // to care
  cared: 'care', cares: 'care', caring: 'care',
  // to fix
  fixed: 'fix', fixes: 'fix', fixing: 'fix',
  // to check
  checked: 'check', checks: 'check', checking: 'check',
  // to turn
  turned: 'turn', turns: 'turn', turning: 'turn',
  // to pass
  passed: 'pass', passes: 'pass', passing: 'pass',
  // name aliases
  feelings: 'feel', feeling: 'feel',
  agreement: 'agree', disagreement: 'disagree',
  explanation: 'explain', comparison: 'compare',
  description: 'describe', inclusion: 'include',
  marriage: 'married', marriages: 'married',
};

// Suffixes to strip when looking up a word (in order of priority)
const STRIP_SUFFIXES = [
  'ness', 'ment', 'tion', 'sion', 'ous', 'ful', 'ive', 'ible', 'able',
  'ing', 'ied', 'ied', 'ves', 'ies', 'ers', 'est', 'ely', 'ily',
  'ed', 'er', 'ly', 'es', 's',
];

// ============================================================
// Public API: look up a word → WordSign (or null = fingerspell)
// ============================================================

/** Digit words for converting numeric characters to sign-lookup keys */
const DIGIT_WORDS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
  '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
};
/** Multi-digit number words (handles spoken numbers like "13", "20", etc.) */
const NUMBER_WORDS: Record<string, string> = {
  '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen',
  '14': 'fourteen', '15': 'fifteen', '16': 'sixteen', '17': 'seventeen',
  '18': 'eighteen', '19': 'nineteen', '20': 'twenty', '21': 'twenty-one',
  '30': 'thirty', '40': 'forty', '50': 'fifty', '60': 'sixty',
  '70': 'seventy', '80': 'eighty', '90': 'ninety', '100': 'hundred',
};

/** Strip punctuation and lowercase; convert digit strings to number words */
function normalise(raw: string): string {
  // First convert digit sequences to their word equivalents
  const withWords = raw.replace(/\b\d+\b/g, (n) => NUMBER_WORDS[n] ?? (DIGIT_WORDS[n] ?? n));
  return withWords.toLowerCase().replace(/[^a-z'\s-]/g, '').trim();
}

/** Try to find sign for a word, performing morphological reduction */
export function lookupSign(rawWord: string): WordSign | null {
  const word = normalise(rawWord);
  if (!word) return null;

  // 1. Direct match
  if (WORD_SIGNS[word]) return WORD_SIGNS[word];

  // 2. Irregular form
  if (IRREGULAR[word]) {
    const base = IRREGULAR[word];
    if (WORD_SIGNS[base]) return WORD_SIGNS[base];
  }

  // 3. Strip suffixes
  for (const suffix of STRIP_SUFFIXES) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      const stem = word.slice(0, word.length - suffix.length);
      if (WORD_SIGNS[stem]) return WORD_SIGNS[stem];
      // Handle doubled consonant (running → run, hopped → hop)
      if (stem.length > 1 && stem[stem.length - 1] === stem[stem.length - 2]) {
        const dedoubled = stem.slice(0, -1);
        if (WORD_SIGNS[dedoubled]) return WORD_SIGNS[dedoubled];
      }
      // Handle -e drop (making → make, loved → love)
      if (WORD_SIGNS[stem + 'e']) return WORD_SIGNS[stem + 'e'];
    }
  }

  return null; // signal: fingerspell
}

/** Convert a word to its fingerspelling sequence of HandPoses */
export function fingerspellWord(word: string): HandPose[] {
  return word
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .split('')
    .map(ch => FINGERSPELLING[ch.toUpperCase()] ?? FINGERSPELLING.A);
}

/**
 * Primary public API for SignAvatar.
 * Converts a raw spoken word into a sequence of sign keyframes.
 * Falls back to letter-by-letter fingerspelling if no sign exists.
 */
export function wordToSignQueue(rawWord: string): SignKeyframe[] {
  const word = normalise(rawWord);
  if (!word) return [];

  const sign = lookupSign(word);
  if (sign) {
    return sign.frames.map(f => ({ ...f, face: f.face ?? NEUTRAL_FACE }));
  }

  // Fingerspell each letter with a short hold
  const letters = fingerspellWord(word);
  if (!letters.length) return [];
  return letters.map(pose => ({
    right: pose,
    left:  FIST,
    face:  NEUTRAL_FACE,
    holdMs: 200,
  }));
}
