# SignFlow - Real-time Speech to ASL Translation

## Overview

SignFlow is a real-time speech-to-ASL (American Sign Language) translation web application. Users speak into their microphone, speech is transcribed via Deepgram's speech-to-text API, and the recognized words are translated into ASL signs performed by a 3D avatar rendered with Three.js. The app stores translation history in a PostgreSQL database.

The core flow is: **Microphone → Deepgram STT → ASL pose lookup → 3D avatar animation**.

### UI Design
- Full-screen nature background image (attached_assets/image_1771963051387.png) with dark overlay
- Glass-morphism cards for avatar container and transcript box
- Transparent 3D canvas (alpha: true) so avatar blends with background
- Premium dark theme with frosted glass buttons and controls

## User Preferences

Preferred communication style: Simple, everyday language.

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
  - `avatar-model.ts` (`AvatarController` class) — Loads GLTF model (`TalkingHead brunette.glb`, white female, Mixamo skeleton with 67 joints, 72 ARKit morph targets). Manages AnimationMixer for FBX mocap playback, bone-based IK for arms/hands, hand poses, and facial expressions. FBX track names are remapped by stripping `mixamorig:` prefix to match model bones.
  - `asl-animation.ts` — Word/letter animation URL resolver. Maps words to `/animations/words/{word}.fbx` and letters to `/animations/letters/{LETTER}.fbx`. 10 word animations + 26 letter fingerspelling animations from Studio Galt ASL Mocap Archive (CC0 licensed, Mixamo-compatible).
  - `asl-poses.ts` — Fallback ASL pose dictionary mapping 400+ English words to hand poses. Used when FBX mocap data is not available for a word.
  - **Animation pipeline**: Word FBX → pose queue fallback → fingerspell via letter FBXs. Sequential async processing with AbortController for cancellation. Clip caching avoids reloading.
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

### Database
- **PostgreSQL** via `DATABASE_URL` environment variable
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema** (`shared/schema.ts`): Single `translations` table with `id` (serial), `original_text` (text), `created_at` (timestamp)
- **Migrations**: Drizzle Kit with `db:push` command for schema sync
- **Storage layer**: `server/storage.ts` provides a `DatabaseStorage` class implementing `IStorage` interface

### Speech-to-Text Pipeline
- Client fetches a Deepgram API key from `/api/deepgram/token`
- `use-speech.ts` hook manages MediaRecorder + Deepgram LiveClient WebSocket connection
- Interim and final transcription results are tracked separately
- New finalized words are queued for the avatar to sign

### Dark Theme
The app uses a premium dark theme by default with CSS custom properties for all color tokens. No light mode toggle exists.

## External Dependencies

### Required Environment Variables
- **`DATABASE_URL`** — PostgreSQL connection string (required, app crashes without it)
- **`DEEPGRAM_API_KEY`** — Deepgram API key for speech-to-text (required for STT functionality)

### Third-Party Services
- **Deepgram** — Real-time speech-to-text via WebSocket. The client connects directly to Deepgram using the API key fetched from the server.
- **PostgreSQL** — Primary data store for translation history. Uses `pg` driver with `connect-pg-simple` for session support.

### Key NPM Packages
- `three` + `@types/three` — 3D rendering engine for the signing avatar
- `@deepgram/sdk` — Deepgram client SDK for live transcription
- `drizzle-orm` + `drizzle-kit` + `drizzle-zod` — Database ORM and schema tools
- `framer-motion` — Animation library for UI components
- `wouter` — Lightweight React router
- `@tanstack/react-query` — Server state management
- `zod` — Runtime schema validation (shared between client and server)
- Full shadcn/ui component library with Radix UI primitives