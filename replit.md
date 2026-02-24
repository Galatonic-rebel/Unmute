# SignFlow - Real-time Bidirectional ASL Translation

## Overview

SignFlow is a real-time bidirectional ASL (American Sign Language) translation web application with two modes:

1. **Speech → ASL**: Users speak into their microphone, speech is transcribed via Deepgram's speech-to-text API, and the recognized words are translated into ASL signs performed by a 3D avatar rendered with Three.js.
2. **ASL → Speech**: Users sign in front of their webcam, MediaPipe detects hand landmarks in real-time, signs are matched against the ASL pose dictionary, recognized words are polished into natural sentences via OpenAI, and spoken aloud via AI TTS.

The app stores translation history in a PostgreSQL database.

### UI Design
- Full-screen nature background image (attached_assets/image_1771963051387.png) with dark overlay
- Glass-morphism cards for avatar container and camera feed
- Transparent 3D canvas (alpha: true) so avatar blends with background
- Premium dark theme with frosted glass buttons and controls
- Mode toggle in header switches between Speech→ASL and ASL→Speech
- Movie-style subtitles overlay on both avatar and camera views

## User Preferences

Preferred communication style: Simple, everyday language (Chinese).

## System Architecture

### Monorepo Structure
The project uses a single-repo layout with three top-level directories:
- **`client/`** — React frontend (Vite + TypeScript)
- **`server/`** — Express backend (Node.js + TypeScript)
- **`shared/`** — Shared types, schemas, and route definitions used by both client and server

### Frontend (`client/src/`)
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
- **State/Data fetching**: TanStack React Query for server state management
- **UI Components**: shadcn/ui (new-york style) with Radix UI primitives, Tailwind CSS for styling
- **Animations**: Framer Motion for UI transitions
- **3D Rendering**: Three.js with GLTFLoader + FBXLoader for the signing avatar
  - `SignAvatar.tsx` — Main avatar component, manages Three.js scene, camera, renderer, animation playback loop
  - `avatar-model.ts` (`AvatarController` class) — Loads GLTF model (RPM female 65367050b6ff020dad1ebc57.glb, Mixamo skeleton, 52 ARKit morph targets). Manages AnimationMixer for FBX mocap playback, bone-based IK for arms/hands, hand poses, and facial expressions. Shoulders permanently spread outward and excluded from animation to prevent arm clipping.
  - `asl-animation.ts` — Word/letter animation URL resolver. Maps words to `/animations/words/{word}.fbx` and letters to `/animations/letters/{LETTER}.fbx`. 10 word animations + 26 letter fingerspelling animations from Studio Galt ASL Mocap Archive.
  - `asl-poses.ts` — ASL pose dictionary mapping 500+ English words to hand poses with keyframe sequences.
  - **Animation pipeline**: Word FBX → pose queue fallback → fingerspell via letter FBXs. ClampWhenFinished holds poses between words. Crossfade duration: 0.45s.
- **Computer Vision** (ASL → Speech mode):
  - `pose-detector.ts` — MediaPipe integration with **three models**: HandLandmarker (21 hand landmarks per hand), PoseLandmarker (33 body landmarks for arm/shoulder/head positions), FaceLandmarker (blend shapes for facial expressions). Computes hand position relative to body (posX/posY/posZ using shoulder midpoint as origin) and maps face blend shapes to FaceExpression interface.
  - `sign-matcher.ts` — Multi-feature sign matching: handshape distance (35%), position distance (50%), face expression distance (15%). Two-tier matching: first filters by position region (forehead/face/chin/chest/low), then ranks by combined distance. Temporal stability (8 frames) + cooldown (15 frames).
  - `use-sign-detection.ts` — React hook managing webcam stream and detection loop at ~15fps. Passes full detection result (hand poses + positions + face) to matcher.
  - `CameraFeed.tsx` — Camera feed component with hand landmark overlay (cyan), body skeleton overlay (yellow), head circle (blue), recognized signs display, speak/clear controls.
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend (`server/`)
- **Framework**: Express.js on Node.js
- **Dev server**: Vite dev server middleware in development mode, static file serving in production
- **API routes** defined in `server/routes.ts`, with route contracts in `shared/routes.ts`
- **Build**: Custom build script using esbuild (server) + Vite (client), output to `dist/`

### API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/deepgram/token` | Returns Deepgram API key for client-side STT connection |
| GET | `/api/translations` | Lists all saved translation records |
| POST | `/api/translations` | Saves a new translation record |
| POST | `/api/polish-sentence` | OpenAI LLM polishes ASL word sequence into natural English |
| POST | `/api/tts` | OpenAI gpt-audio TTS — converts text to WAV audio |

### Database
- **PostgreSQL** via `DATABASE_URL` environment variable
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema** (`shared/schema.ts`): Single `translations` table with `id` (serial), `original_text` (text), `created_at` (timestamp)
- **Migrations**: Drizzle Kit with `db:push` command for schema sync
- **Storage layer**: `server/storage.ts` provides a `DatabaseStorage` class implementing `IStorage` interface

### Speech-to-Text Pipeline (Speech → ASL)
- Client fetches a Deepgram API key from `/api/deepgram/token`
- `use-speech.ts` hook manages MediaRecorder + Deepgram LiveClient WebSocket connection
- Interim and final transcription results are tracked separately
- New finalized words are queued for the avatar to sign
- Movie-style subtitles: cleared on UtteranceEnd event after 1.5s delay

### Sign Detection Pipeline (ASL → Speech)
- `use-sign-detection.ts` manages webcam + MediaPipe HandLandmarker + PoseLandmarker + FaceLandmarker
- Each frame: hand landmarks → HandPose + body landmarks → hand-relative position + face blend shapes → FaceExpression
- Sign matching uses combined distance: handshape (35%) + position relative to body (50%) + facial expression (15%)
- Two-tier matching: first filter by position region, then rank by combined distance
- Recognized words accumulate; user taps "Speak" to polish via DeepSeek and play TTS via OpenAI

### Dark Theme
The app uses a premium dark theme by default with CSS custom properties for all color tokens. No light mode toggle exists.

## External Dependencies

### Required Environment Variables
- **`DATABASE_URL`** — PostgreSQL connection string (required, app crashes without it)
- **`DEEPGRAM_API_KEY`** — Deepgram API key for speech-to-text (required for STT functionality)
- **`AI_INTEGRATIONS_OPENAI_BASE_URL`** — Auto-set by Replit AI Integrations
- **`AI_INTEGRATIONS_OPENAI_API_KEY`** — Auto-set by Replit AI Integrations

### Third-Party Services
- **Deepgram** — Real-time speech-to-text via WebSocket
- **DeepSeek** — LLM sentence polishing (deepseek-chat model) for ASL→English translation
- **OpenAI (via Replit AI Integrations)** — TTS (gpt-audio) for speaking polished sentences
- **MediaPipe** — Client-side hand landmark detection for ASL recognition
- **PostgreSQL** — Primary data store for translation history

### Key NPM Packages
- `three` + `@types/three` — 3D rendering engine for the signing avatar
- `@deepgram/sdk` — Deepgram client SDK for live transcription
- `@mediapipe/tasks-vision` — Hand landmark detection for ASL recognition
- `openai` — OpenAI SDK for sentence polishing and TTS
- `drizzle-orm` + `drizzle-kit` + `drizzle-zod` — Database ORM and schema tools
- `framer-motion` — Animation library for UI components
- `wouter` — Lightweight React router
- `@tanstack/react-query` — Server state management
- `zod` — Runtime schema validation (shared between client and server)
- Full shadcn/ui component library with Radix UI primitives
