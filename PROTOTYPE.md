# unmute — SignFlow-Based Two-Way Communication Prototype

> Product name: **unmute** (tagline *sign without words*; earlier working name "SignBridge
> Studio"). Built on the open-source SignFlow engine (MIT).

A working prototype built on top of [SignFlow](https://github.com/Leander-bai/SignFlow) (MIT) by
Leander-bai. It demonstrates two-way communication between a signing person and a
non-signing person using **American Sign Language (ASL)** only.

> ⚠️ Honest scope statement: this is a **limited-vocabulary ASL prototype*,
> not a full sign-language translator. See Limitations.

---

## Quick start (Windows)

### Option A — Streamlit shell (recommended; double-click)

```text
run_unmute.bat
```

Needs Python 3.10+ and Streamlit (`python -m pip install streamlit`). The Streamlit app
(`unmute_app.py`) is a branded landing/dashboard + launcher: on first run it builds
the web app (Node required once), then serves it from a tiny local Python static
server (`http-server`-class, no Express/DB) and provides the "Launch unmute" button.
URLs: Streamlit dashboard on `:8601` (default), the engine app on `:8618`
(both configurable; engine port via `UNMUTE_PORT`).

The engine opens in a **new browser tab** on purpose — embedding the webcam app in a
cross-origin Streamlit iframe causes camera permission-delegation failures.

### Option B — plain dev run

```powershell
cd SignFlow
npm install                      # once
$env:NODE_ENV  = 'development'
$env:PORT      = '5000'
$env:DATABASE_URL = 'postgresql://placeholder:notused@localhost:5432/placeholder'   # any placeholder; DB is unused by the prototype
node node_modules\tsx\dist\cli.mjs server/index.ts
```

Open **http://localhost:5000/** — the app IS unmute now (user decision, 2026-10-20):
the original SignFlow page is removed from routing. Its source (`pages/Home.tsx` and the
Deepgram/OpenAI/backend paths) is still on disk, untouched, and can be restored by adding its
route back in `App.tsx`. Nothing was deleted.

Requirements: Node 20.19+ / 22+ (tested on Node 22.22, Windows 10/11), a webcam, and internet
access on first load (MediaPipe WASM + model files load from Google's CDN and are then cached).
**No API keys, no PostgreSQL, no paid services are needed for the prototype.**
Works on a typical Windows laptop; uses WebGL GPU inference (Chrome/Edge recommended).

---

## What the prototype does

### Left panel — Sign → Text
- Webcam access after explicit permission; live feed with mirrored view + landmark overlay
  (hand skeleton, body anchors — drawn locally, nothing uploaded).
- MediaPipe HandLandmarker + PoseLandmarker + FaceLandmarker at ~15 fps (reused from SignFlow).
- Sign matching (reused `sign-matcher.ts`) restricted to a curated vocabulary:
  **hello, thank you, yes, no, please, sorry, help, water, eat, drink, want** (11 signs).
  Fingerspelling-letter competition is disabled during recognition.
- Live captions of recognized signs + confidence %, a timestamped **transcript**, and
  **non-sign feedback states**: "No hands in view", "No supported sign detected",
  "Gesture visible — uncertain (closest: …)", "Detecting … hold still".
- Start / Stop / Reset controls; permission-denied and no-camera error states.

### Right panel — Text → Sign
- **Conversation loop:** recognized signs are buffered into an utterance (ends after ~3.5 s of
  pause); each utterance is added to the conversation, and — when **Auto-reply** is on — a local
  rule-based reply is generated, shown as a caption, and signed by the avatar. No API, no LLM.
- Text box (or quick-reply chips) → every word is mapped through SignFlow's
  `wordToSignQueue()` (alias + morphology aware).
- 3D Ready Player Me avatar signs the message word-by-word:
  1. FBX mocap animation if one exists (10 words),
  2. procedural pose animation from the ~610-entry ASL pose dictionary,
  3. finger-spelling letter-by-letter as final fallback (26 letter FBX).
- Caption sync: the word currently being signed is highlighted with a tag
  ("mocap animation" / "procedural sign" / "fingerspelled (no sign)"), and the
  indicator clears automatically when the queue finishes.
- Pre-send vocabulary check: green = has a real sign, amber = will be fingerspelled.
- Optional voice playback of the message via the free browser SpeechSynthesis API.
- **Pace control (S / N / F)** — scales how long each sign is held (0.8× / 1.3× / 1.6× of
  authored timing; default N). Implementer note: SignFlow's own playback runs at `holdMs × 0.55`
  (faster than authored), so the default N was set to 1.3 to counteract that.
- Empty state, clear fallback behaviour for unknown words (disclosed, not hidden).

### Quality fixes after user testing (why recognition/avatar felt off)
- **Recognition inconsistency** → added temporal smoothing (exponential moving average,
  α = 0.45) over the raw per-frame hand-pose, hand-position and face features inside
  `PoseDetector.detect()`. Raw estimates flicker frame-to-frame, which made the matcher's
  ranking flip between similar signs; smoothing removes most single-frame jitter while
  adding only ~130 ms lag. Reset when hands leave the frame. Additive + behind the public
  `detector.smoothingAlpha` flag (1 = off).
- **Avatar "glitchy snap"** → keyframe transitions in `SignAvatar` softened: blend-in window
  80 ms → 160 ms, hand/position lerp speeds reduced (dt/35 → dt/60, dt/40 → dt/65). These
  constants are shared with the original app (Home benefits too) — flagged here as a change.
- **"Canned" replies** → each intent now has 2 reply variants, chosen in rotation, plus the
  combo rules. Still fully local and rule-based.

---

## What was reused from SignFlow (and what was added)

### Reused as-is
| Component | Role |
|---|---|
| `pose-detector.ts` | MediaPipe wrapper, GPU delegate, hand/body/face feature extraction, body-relative position normalization — **modified additively**: EMA temporal smoothing of extracted features (see quality fixes below) |
| `sign-matcher.ts` | Multi-feature weighted matching, stability/cooldown filtering, calibration, context priors |
| `asl-poses.ts` | ~610-entry ASL pose dictionary + fingerspelling handshapes + word-alias/lookup API |
| `avatar-model.ts` | AvatarController: two-bone IK, per-joint fingers, ARKit blend-shape expressions |
| `SignAvatar.tsx` | Three.js scene, animation mixer, FBX loading, sign queue processing — **modified additively**: `pace` prop, softer keyframe transitions, `onWordChange`/`onIdle` hooks |
| `asl-animation.ts` + `client/public/animations/**` + `avatar.glb` | FBX mocap (26 letters + 10 words) and RPM avatar |

### Added (all additive — defaults preserve original behavior)
| Change | Why |
|---|---|
| `sign-matcher.ts`: optional `{ vocabulary, includeLetters }` constructor options | Recognition over all ~610 signs + free-scoring letter candidates produced wrong words in live tests; the prototype limits matching to well-separated signs |
| `use-sign-detection.ts`: optional matcher options pass-through + `lastConfidence` exposure | So the UI can surface confidence and uncertainty instead of silently hiding weak matches |
| `SignAvatar.tsx`: optional `onWordChange`, `onIdle`, `hideSpeechLabels` props | Caption sync + idle detection + embedder-controlled labels |
| `SignAvatar.tsx`: queue-stash fix | Messages sent while `avatar.glb` was still loading were silently dropped; they now replay |
| `pages/Studio.tsx` (new, routed at `/`, replacing Home route in `App.tsx`) | The two-panel prototype UI itself, plus the conversation loop: utterance buffering with pause-based end-of-utterance detection, local rule-based reply engine, chat transcript |
| `server/index.ts`: `reusePort: false` | Windows compatibility fix (SO_REUSEPORT is unsupported, caused a boot crash) |

### Removed from the prototype's path (still in the repo, unused by Studio)
Deepgram STT, DeepSeek sentence-polishing, OpenAI TTS, PostgreSQL history — all require paid
API keys. The prototype uses typed text, local captions and free browser speech synthesis instead.

---

## How recognition works (unchanged algorithm, restricted pool)

Per frame: extract finger curl/spread, thumb flex/abduction, wrist rotation, hand position
relative to the body (shoulder-normalized), and facial blend shapes →
combined distance = handshape (0.25) + position (0.60) + face (0.15) →
region pre-filter → calibration offsets + bigram context priors →
stability required (10 frames, or 4 below 50 % threshold) → recognition fires with cooldown.

The original repo's 19 unit tests for the matcher still pass unmodified (19/19).

**Why recognition is wrong-word-prone in the original app** (verified during this project):
26 fingerspelling-letter candidates score with `posDist = 0`, out-ranking real signs for open
handshapes, and ~610 signs are compared by static first-frame only. The prototype's fix is
vocabulary restriction, not a new model.

---

## Supported vocabulary & language

- **Language: ASL only.** ISL is not implemented anywhere in SignFlow and is not implemented here.
- Recognition vocabulary (11): listed above. Chosen for maximal first-frame separation;
  deliberately excluded: `good` (identical first frame to `thank you`), `my` (near-identical to
  `please`), and all letters.
- Avatar signing vocabulary: ~610 word signs (dictionary), 10 FBX mocap words, 26 letters fingerspell.

## Model & asset sources
- MediaPipe Tasks Vision WASM + HandLandmarker/PoseLandmarker/FaceLandmarker `.task` weights —
  Google CDN (Apache-2.0), cached after first load.
- `avatar.glb` (Ready Player Me avatar, Mixamo skeleton), `animations/letters/A-Z.fbx`,
  `animations/words/*.fbx` — shipped in the SignFlow repo (MIT license).

---

## Known limitations
1. **ASL only; limited vocabulary on purpose.** 11 recognition signs, disclosed in the UI. Anything
   outside the list produces no caption (no false positives), and "uncertain" feedback instead of
   guesses.
2. **Static-pose matching.** The matcher compares single held frames; motion-dependent signs
   (circles, arcs) are matched by their held shape only, so some real ASL signs cannot be
   distinguished (e.g., circular motions like please/sorry).
3. **First-frame matching means "good" etc. must be excluded** (identical to "thank you" at frame 1).
4. Sign quality depends on framing, lighting and distance; MediaPipe features are heuristic, not a
   trained classifier — expect false negatives and occasional misfires even on the 11 signs.
5. Frame pacing needs GPU WebGL; CPU-only runs visibly slower (~3 fps worst case).
6. The avatar's procedural signs approximate ASL grammar linearly — it is a vocabulary player,
   not full ASL grammar/syntax (no non-manual-markers for questions beyond static faces).
7.utter model training was intentionally skipped in v1 (per project constraints).

## Suggested next steps
1. **User-calibration recording**: capture a few seconds of the user's neutral/gesture data to
   auto-fit per-user offsets (the codebase's calibration system supports per-sign offsets already).
2. **Motion-aware matching**: accumulate low-dimensional trajectories (wrist path) over the hold
   window and add a trajectory-distance term — can disambiguate please/sorry/want.
3. **Recognition vocabulary growth** guided by confusion matrices: add signs only where the
   matcher's distance distribution shows separation.
4. **ISL track**: ISL needs its own vocabulary, recognition model and animations; feasible path is
   Community-provided ISL word videos → pose extraction → same avatar system. Do not claim ISL
   support until then.
5. **Browser SpeechRecognition** (Chrome/Edge, free) for spoken input instead of Deepgram.
6. **Peer pairing**: two devices viewing each other's captions (WebRTC) to make it a true two-person demo.

---

## Verification status (no fabricated results)

Tested/verified:
- ✅ Prototype boots and renders (desktop-layout screenshot reviewed).
- ✅ Text → sign: quick-reply and typed send produce queued signing; word chips update
  ("thank you so much" → words playback, fallback tag for sign-less words); idle callback works.
- ✅ Messages sent while the avatar loads are queued, not dropped.
- ✅ Matcher unit tests 19/19; TypeScript error count matches the pristine repo baseline exactly.
- ✅ (2026-10-20) Original app removed from routing per user request — `/` serves the app;
  `Home.tsx` remains on disk unrouted (verified: root URL loads the app, no "Original app" link,
  typed-message flow works at `/`, UI polish pass verified in browser).
- ✅ (2026-10-20) **Renamed to "unmute"** and deployed behind a **Streamlit shell**
  (`unmute_app.py` + `run_unmute.bat`): landing/dashboard + launcher that builds on first run
  and serves the production bundle (`dist/public`) from a local Python static server.
  Verified end-to-end in the browser: Streamlit page renders with "engine running" status,
  launch link targets `http://localhost:8618/`, the built app boots from the Python server
  (correct MIME for JS/GLB/FBX), and the typed-message flow works there too.
  Note: this is a *local-machine* deployment. A cloud Streamlit deployment additionally needs
  the static engine bundle hosted on a public HTTPS origin (any free static host can serve
  `dist/public` verbatim); camera access works there because the engine would run in its own
  top-level tab over HTTPS.
- ⏳ **Camera/recognition end-to-end with real hands** — requires a human signer; pending user
  verification. Uncertainty/feedback states implemented but live accuracy not measured yet.
