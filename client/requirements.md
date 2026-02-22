## Packages
framer-motion | For fluid animations in the avatar and UI transitions
@deepgram/sdk | For real-time speech-to-text processing

## Notes
- The app uses Deepgram for real-time speech-to-text. It fetches a temporary token from `/api/deepgram/token`.
- Make sure the browser allows microphone access (`navigator.mediaDevices.getUserMedia`).
- The 3D avatar is abstracted into a stylized animated UI component for the MVP, reacting to recognized words in real-time.
