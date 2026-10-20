"""
unmute — Streamlit shell for the unmute web app.

unmute's real-time engine (webcam + MediaPipe + Three.js avatar) is a React
single-page app built from client/ into dist/public/. Streamlit cannot execute
that engine in Python, so this app has two jobs:

  1. Build the web app on first run, then serve it from a local static server
     managed by this process (no Node/Express server needed at runtime).
  2. Act as a branded landing/dashboard and launch point for the live app.

The landing page opens the engine in a full browser tab (rather than embedding
it in an iframe on purpose: iframe cross-origin camera permission delegation is
unreliable across browsers; a normal tab always works).

Everything runs locally: no API keys, no cloud services, no video leaves the
machine.

Run with:
    python -m streamlit run unmute_app.py

or just double-click run_unmute.bat.
"""

import mimetypes
import os
import subprocess
import threading
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import streamlit as st

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist" / "public"
PORT = int(os.environ.get("UNMUTE_PORT", "8618"))
APP_URL = f"http://localhost:{PORT}/"

# ── Curated vocabulary (kept in sync with the web app's Studio.tsx) ──────────
SUPPORTED_SIGNS = {
    "hello": "open hand at temple, wiggle",
    "thank you": "flat hand at chin, sweep forward",
    "yes": "fist, nod up and down",
    "no": "two fingers tap thumb",
    "please": "flat hand on chest, rub circles",
    "sorry": "fist on chest, rub circles",
    "help": "fist on open palm, raise together",
    "water": "W-handshape at lips, tap",
    "eat": "O-handshape at mouth, repeat",
    "drink": "C-handshape at mouth, tilt",
    "want": "both open hands, pull toward you",
}

# Windows' MIME registry quirks would break asset loading (glb/fbx/wasm), so pin exactly.
MIME_OVERRIDES = {
    ".glb": "model/gltf-binary",
    ".fbx": "application/octet-stream",
    ".wasm": "application/wasm",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".html": "text/html; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
}


class UnmuteHandler(SimpleHTTPRequestHandler):
    """Static file server with SPA fallback and pinned MIME types."""

    def do_GET(self):  # noqa: N802
        if not os.path.isfile(self.translate_path(self.path.split("?")[0])):
            self.path = "/index.html"
        return SimpleHTTPRequestHandler.do_GET(self)

    def guess_type(self, path):
        ext = Path(path).suffix.lower()
        if ext in MIME_OVERRIDES:
            return MIME_OVERRIDES[ext]
        return mimetypes.guess_type(path)[0] or "application/octet-stream"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, format, *args):  # silence request logs
        pass


def ensure_build() -> bool:
    """Build the web app into dist/public if it hasn't been built yet."""
    if (DIST_DIR / "index.html").exists():
        return True
    with st.spinner("Building unmute (first run only, ~30 s)…"):
        try:
            subprocess.run(
                ["node", "node_modules/tsx/dist/cli.mjs", "script/build.ts"],
                cwd=BASE_DIR,
                check=True,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            st.error(
                "**Node.js is required to build unmute on first run.** "
                "Install Node 20+ (or run `node node_modules/tsx/dist/cli.mjs script/build.ts` "
                "in the project folder once), then refresh this page."
            )
            return False
        except subprocess.CalledProcessError as exc:
            st.error(f"Build failed:\n\n```\n{exc.stdout[-2000:]}\n```")
            return False
    return True


@st.cache_resource
def start_static_server():
    """Start the static server once (survives Streamlit reruns)."""
    handler = partial(UnmuteHandler, directory=str(DIST_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    thread = threading.Thread(target=server.serve_forever, name="unmute-static", daemon=True)
    thread.start()
    return server


def server_is_up() -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=1) as resp:
            return resp.status == 200
    except Exception:
        return False


# ── Streamlit page ──────────────────────────────────────────────────────────
st.set_page_config(page_title="unmute", page_icon="🤟", layout="centered")

st.markdown(
    """
    <style>
      #MainMenu { visibility: hidden; }
      footer { visibility: hidden; }
      header[data-testid="stHeader"] { background: transparent; }
      .block-container { padding-top: 1.5rem; }
      .stApp { background: linear-gradient(180deg, #020617 0%, #0f172a 100%); color: #e2e8f0; }
      h1, p, h2, h3, li { color: inherit; }
    </style>
    """,
    unsafe_allow_html=True,
)

# Header
st.markdown(
    f"""
    <div style="text-align:center; padding: .5rem 0 0;">
      <h1 style="font-size: 3.2rem; font-weight: 800; margin-bottom: 0; letter-spacing: -0.02em;">
        un<span style="background: linear-gradient(135deg, #34d399, #6366f1);
        -webkit-background-clip: text; background-clip: text; color: transparent;">mute</span>
      </h1>
      <p style="font-size: 1.05rem; color: #94a3b8; margin-top: .2rem;">sign without words</p>
      <p style="font-size: .8rem; color: #64748b; margin-top: .3rem;">
        Two-way ASL communication · webcam sign recognition + 3D signing avatar
      </p>
    </div>
    """,
    unsafe_allow_html=True,
)

if not ensure_build():
    st.stop()

# Start + verify the engine server
try:
    start_static_server()
except OSError as exc:
    st.error(
        f"Could not start the local engine server on port {PORT} ({exc}).\n\n"
        "Another program may be using that port — set the `UNMUTE_PORT` environment "
        "variable to a free port and restart.\n\n"
        f"You can still open unmute directly at http://localhost:{PORT}/ if it is already running."
    )
    st.stop()

ready = server_is_up()

# Launch button
b1, b2 = st.columns([3, 2])
with b1:
    st.link_button(
        "🤟  Launch unmute" + ("" if ready else "  (engine starting…)"),
        APP_URL,
        type="primary",
        use_container_width=True,
    )
with b2:
    st.markdown(
        f'<div style="padding-top:.45rem; text-align:center; font-size:.8rem; color:#94a3b8;">'
        f'{"🟢 engine running locally" if ready else "🟡 engine warming up"}<br>'
        f'<code style="font-size:.72rem;">localhost:{PORT}</code></div>',
        unsafe_allow_html=True,
    )

if not ready:
    st.info("The engine server just started — click the button again in a few seconds.")

st.divider()

# Metrics
m1, m2, m3 = st.columns(3)
m1.metric("ASL signs supported", len(SUPPORTED_SIGNS))
m2.metric("API keys required", 0)
m3.metric("Video leaves your device", "Never")

st.divider()

# How it works
with st.expander("How it works", expanded=True):
    st.markdown(
        """
**Left panel — Sign → Text**  \n3 MediaPipe models (hands, body, face) run in your browser at
~15 fps. Recognized hand poses are matched against the curated vocabulary, buffered into
utterances (a ~3.5 s pause ends an utterance), shown as captions, and — when auto-reply is on —
answered by a local rule-based reply engine.

**Right panel — Text → Sign**  \nYour typed message is mapped onto the 3D Ready Player Me
avatar: real FBX mocap clips where available, procedural pose-signs from a ~610-entry
dictionary otherwise, fingerspelling for everything else. Optional browser voice playback.

The conversation view shows signed utterances, typed messages, and replies in order.
        """
    )

# Vocabulary
with st.expander("Supported signs — hold each one still for about a second"):
    for sign, hint in SUPPORTED_SIGNS.items():
        st.markdown(f"**{sign}** · <span style='color:#94a3b8'>{hint}</span>", unsafe_allow_html=True)
    st.caption("Anything outside this vocabulary produces no caption (silence is honest) and unknown "
               "reply words are fingerspelled letter-by-letter.")

# Limitations — disclosed, never hidden
with st.expander("Limitations (important)"):
    st.markdown(
        """
- **ASL only**, and only a deliberately small vocabulary (the 11 signs above).
- Recognition is a **heuristic matcher over static pose features**, not a trained model —
  expect inconsistent results, especially for signs that differ mostly by movement
  (`please`/`sorry`/`want`).
- The avatar signs word-by-word with uniform timing: readable, but not natural ASL grammar
  or fluency; most words are procedural poses rather than full-body mocap.
- Reply lines are simple locally-generated mappings, not a language model.
- Device requirements: webcam, modern Chromium-based browser, internet on first load
  (MediaPipe models load from a CDN, then are cached).
        """
    )

# Privacy / tech
with st.expander("Privacy & tech stack"):
    st.markdown(
        """
- **All processing is local**: camera frames never leave the device — MediaPipe runs
  entirely in the browser via WASM/WebGL; the static server only serves files.
- Engine: React + Three.js (SignFlow open-source engine, MIT) + MediaPipe Tasks Vision.
- Shell: Python/Streamlit — launches and monitors the local server, dashboard only.
- First load downloads model files from Google's CDN (then cached by the browser).
        """
    )

st.caption("unmute is a research prototype built on the open-source SignFlow engine (MIT). "
           "It is not affiliated with, and does not replace, human ASL interpretation.")
