# SignFlow

**Real-time Bidirectional ASL Translation with 3D Avatar & Computer Vision**

![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r183-black?logo=three.js&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision-4285F4?logo=google&logoColor=white)
![Deepgram](https://img.shields.io/badge/Deepgram-STT-13EF93?logo=deepgram&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-4169E1?logo=postgresql&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

---

## Features

- **Speech to ASL** -- Speak into your microphone and watch a photorealistic 3D avatar perform ASL signs in real time, powered by Deepgram live transcription and a 500+ word pose dictionary with FBX motion-capture animations.
- **ASL to Speech** -- Sign in front of your webcam and have your signs recognized, polished into natural English by an LLM, and spoken aloud via AI text-to-speech.
- **3D Signing Avatar** -- Ready Player Me avatar with Mixamo skeleton (52 ARKit blend shapes), driven by a custom two-bone IK solver for arm positioning and per-joint quaternion interpolation for finger articulation.
- **Multi-Model Computer Vision** -- Simultaneous MediaPipe HandLandmarker + PoseLandmarker + FaceLandmarker running at ~15 fps, extracting hand shape, body-relative hand position, and facial expressions for multi-feature sign matching.
- **Intelligent Sign Matching** -- Weighted multi-feature distance (handshape 25% + position 60% + face 15%), two-tier region filtering, temporal stability with frame counting, cooldown mechanism, per-sign calibration offsets, and context-aware bigram priors.
- **Premium Dark UI** -- Full-screen nature background with glass-morphism cards, transparent 3D canvas, movie-style subtitle overlays, and Framer Motion transitions.

---

## Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │              Speech → ASL Mode              │
                        │                                             │
  Microphone ──► Deepgram WebSocket (STT) ──► Word Queue             │
                                                  │                   │
                        ┌─────────────────────────┼───────────────────┘
                        │                         ▼
                        │        ┌────────────────────────────┐
                        │        │  Animation Pipeline         │
                        │        │  Word FBX ──► Pose Queue    │
                        │        │  fallback ──► Fingerspell   │
                        │        │  (letter FBX animations)    │
                        │        └────────────┬───────────────┘
                        │                     ▼
                        │        ┌────────────────────────────┐
                        │        │  AvatarController           │
                        │        │  • AnimationMixer (FBX)     │
                        │        │  • Two-bone IK (arms)       │
                        │        │  • Per-joint fingers         │
                        │        │  • ARKit morph targets       │
                        │        └────────────┬───────────────┘
                        │                     ▼
                        │              Three.js Renderer
                        │
  ══════════════════════╪═══════════════════════════════════════
                        │
                        │              ASL → Speech Mode
                        │
                        │        ┌────────────────────────────┐
      Webcam ──────────►│        │  PoseDetector (MediaPipe)   │
                        │        │  • HandLandmarker (21 pts)  │
                        │        │  • PoseLandmarker (33 pts)  │
                        │        │  • FaceLandmarker (blends)  │
                        │        └────────────┬───────────────┘
                        │                     ▼
                        │        ┌────────────────────────────┐
                        │        │  Feature Extraction         │
                        │        │  • Finger curl/spread       │
                        │        │  • Thumb flex/abduction     │
                        │        │  • Wrist rotation (3-axis)  │
                        │        │  • Hand-to-body position    │
                        │        │  • Face blend shapes        │
                        │        └────────────┬───────────────┘
                        │                     ▼
                        │        ┌────────────────────────────┐
                        │        │  SignMatcher                │
                        │        │  • Region pre-filter        │
                        │        │  • Multi-feature distance   │
                        │        │  • Temporal stability       │
                        │        │  • Context priors           │
                        │        └────────────┬───────────────┘
                        │                     ▼
                        │            Recognized Words
                        │                     │
                        │        DeepSeek LLM (polish) ──► TTS (OpenAI)
                        └─────────────────────────────────────────────
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Framer Motion |
| 3D Rendering | Three.js (GLTFLoader, FBXLoader, AnimationMixer, IK solver) |
| Computer Vision | MediaPipe Tasks Vision (Hand, Pose, Face Landmarkers) |
| Speech-to-Text | Deepgram Live WebSocket API |
| LLM | DeepSeek Chat (ASL-to-English polishing) |
| Text-to-Speech | OpenAI gpt-audio (via Replit AI Integrations) |
| Backend | Express.js (Node.js), TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| UI Components | shadcn/ui, Radix UI primitives |
| Routing | Wouter (client), Express (server) |
| State Management | TanStack React Query v5 |

---

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname   # PostgreSQL connection
DEEPGRAM_API_KEY=your_deepgram_key                     # Speech-to-text
DEEPSEEK_API_KEY=your_deepseek_key                     # LLM sentence polishing
AI_INTEGRATIONS_OPENAI_API_KEY=your_key                # TTS (auto-set on Replit)
AI_INTEGRATIONS_OPENAI_BASE_URL=https://...            # TTS base URL (auto-set on Replit)
```

### Install & Run

```bash
npm install
npm run db:push    # Push schema to PostgreSQL
npm run dev        # Start dev server (Express + Vite HMR)
```

The app will be available at `http://localhost:5000`.

### Production Build

```bash
npm run build      # esbuild (server) + Vite (client) → dist/
npm start          # Serve from dist/
```

---

## Project Structure

```
├── client/
│   ├── public/
│   │   ├── avatar.glb                    # RPM avatar model (Mixamo skeleton)
│   │   └── animations/
│   │       ├── letters/  (A-Z.fbx)       # Fingerspelling mocap (26 files)
│   │       └── words/    (hello.fbx...)   # Word-level ASL mocap (10 files)
│   └── src/
│       ├── components/
│       │   ├── SignAvatar.tsx             # 3D avatar scene, animation loop
│       │   ├── CameraFeed.tsx            # Webcam view, landmark overlay
│       │   ├── HistoryPanel.tsx          # Translation history
│       │   └── TranscriptionBox.tsx      # Speech transcription display
│       ├── hooks/
│       │   ├── use-sign-detection.ts     # Webcam + detection loop @ 15fps
│       │   ├── use-speech.ts             # Deepgram STT integration
│       │   └── use-translations.ts       # Translation CRUD hooks
│       ├── lib/
│       │   ├── sign-matcher.ts           # Multi-feature sign recognition
│       │   ├── avatar-model.ts           # AvatarController (IK, fingers, expressions)
│       │   ├── pose-detector.ts          # MediaPipe wrapper + feature extraction
│       │   ├── asl-poses.ts              # 500+ word ASL pose dictionary
│       │   └── asl-animation.ts          # FBX animation URL resolver
│       └── pages/
│           └── Home.tsx                  # Main application page
├── server/
│   ├── routes.ts                         # API endpoints
│   ├── storage.ts                        # Database storage layer
│   └── index.ts                          # Express server setup
└── shared/
    ├── schema.ts                         # Drizzle ORM schema + Zod types
    └── routes.ts                         # Route contracts
```

---

## Core Algorithms

### Sign Matching Engine (`sign-matcher.ts`)

The sign matcher uses a **multi-feature weighted distance** approach to compare detected hand/body/face features against a dictionary of 500+ ASL signs:

**Distance Computation:**
```
Combined Distance = handshapeDistance * 0.25
                  + positionDistance  * 0.60
                  + faceDistance      * 0.15
```

- **Handshape Distance**: Weighted Euclidean distance across 4 finger curl/spread values + thumb flex/abduction + optional wrist rotation. Curl contributes weight 1.0, spread 0.3, thumb flex 0.9, thumb abduction 0.6.
- **Position Distance**: Body-relative hand position mapped to anatomical regions (forehead, face, chin, chest, low) using pose landmark shoulder midpoint as origin. Y-axis weighted 3x higher than X (1x) and Z (0.5x) to prioritize vertical signing space.
- **Face Distance**: Euclidean distance across eyebrow raise, mouth open, mouth smile, cheek puff (0.5x), and eye squint (0.5x).

**Two-Tier Matching:**
1. Region pre-filter: Skip candidates whose position region differs by more than 1 level from detected hand position.
2. Rank by combined distance, apply calibration offsets and context priors, then re-rank.

**Temporal Stability:**
- A sign must be the top candidate for **10 consecutive frames** (or **4 frames** if distance < 50% of threshold) before being recognized.
- After recognition, an **8-frame cooldown** prevents duplicate detections.

**Context Priors:**
- Bigram-based: After recognizing "hello", the distance for "my" gets a -0.04 bonus, "nice" gets -0.03, etc. Models common ASL phrase patterns.

### IK Solver (`avatar-model.ts`)

A custom **two-bone IK** solver positions each arm (shoulder-elbow-hand chain):

1. Compute target position in model space from ASL pose's `posX/posY/posZ`.
2. Reset arm to rest pose, get world-space shoulder position.
3. Use law of cosines to find elbow angle: `cos(A) = (L1^2 + D^2 - L2^2) / (2 * L1 * D)`.
4. Construct pole vector (offset outward +-0.32, down -0.30, back -0.20) for natural elbow orientation.
5. Derive arm rotation from rest direction to desired direction via `Quaternion.setFromUnitVectors()`.
6. Apply forearm correction to point hand at target.
7. SLERP between previous and computed quaternions with parameter `t` for smooth interpolation.

Arms are scaled (0.92/0.93) to prevent self-intersection, and shoulders are permanently spread outward by 0.32 radians.

### Calibration System

Per-sign calibration offsets (`CALIBRATION_OFFSETS`) bias common, high-priority signs like "hello" (-0.10), "thank you" (-0.07) to be recognized more easily. Signs with calibration get preferential re-ranking: if a calibrated sign is within 0.08 distance of the uncalibrated top candidate, it gets promoted to first place.

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/deepgram/token` | Returns Deepgram API key for client STT |
| `GET` | `/api/translations` | Lists all saved translations |
| `POST` | `/api/translations` | Saves a new translation record |
| `POST` | `/api/polish-sentence` | Polishes ASL word sequence into English via DeepSeek |
| `POST` | `/api/tts` | Converts text to WAV audio via OpenAI gpt-audio |

---

## Security

- **Security Headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` set on all responses
- **Rate Limiting** — In-memory per-IP rate limiter (100 req/min) on all `/api` routes to prevent abuse
- **Input Validation** — All API endpoints validate request bodies with Zod schemas before processing
- **API Key Handling** — In production, the Deepgram STT token endpoint should be replaced with short-lived token generation via the Deepgram SDK's `keys.create()` API. The current MVP passes the key directly for development simplicity.

---

## Roadmap

- [ ] Two-handed sign support (signs requiring both hands with distinct poses)
- [ ] Motion trajectory matching for dynamic signs (circular, arc movements)
- [ ] User-specific calibration profiles with per-user offset learning
- [ ] Expanded vocabulary beyond 500 words with community-contributed signs
- [ ] Multi-language support (BSL, LSF, JSL)
- [ ] Offline mode with local ML models (TFLite/ONNX)
- [ ] Mobile-optimized camera pipeline with WebGL2 fallback
- [ ] Video recording and playback of signing sessions

---

## License

MIT
