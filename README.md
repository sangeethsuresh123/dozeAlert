# DozeAlert — Webcam Drowsiness Detector

A web app that detects when you've fallen asleep using your webcam and plays a motivational video playlist until you prove you're awake.

**Live demo**: [doze-alert.vercel.app](https://doze-alert.vercel.app/)

![screenshot](https://img.shields.io/badge/status-active-brightgreen) ![tests](https://img.shields.io/badge/tests-48%20passing-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

## How It Works

1. **Face Tracking** — [MediaPipe FaceLandmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) detects 478 face landmarks in real-time via your webcam. Runs 100% client-side.
2. **Eye Aspect Ratio (EAR)** — Computes a ratio of vertical-to-horizontal eye distances. Drops sharply when eyes close.
3. **Drowsiness Detection** — If EAR stays below a threshold for a configurable duration (default 2.5s), the alarm triggers.
4. **Background Alerts** — Buzzer (Web Audio API) + system notification fire even when the tab is in the background. Video resumes when you switch back.
5. **Anti-groggy Dismissal** — Click "I'm awake" 3 times (1s apart) + keep eyes open for 3 seconds of live verification. Fail either part and it resets.

## Demo

```
1. npm install && npm run dev
2. Open http://localhost:3000 (Chrome/Edge)
3. Click "Start Tracking" → allow camera
4. Close your eyes for ~3 seconds → alarm triggers
5. Dismiss: 3 clicks + 3s eye check
```

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:3000** in Chrome or Edge.

## Deploy

```bash
npm run build              # creates dist/
vercel deploy ./dist --prod  # live URL
```

Or drag-and-drop the `dist/` folder to [app.netlify.com/drop](https://app.netlify.com/drop).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run all 48 tests |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
src/
├── main.js                          # Entry point, wires everything
├── styles.css                       # Dark theme UI
├── tracking/
│   ├── earCalculator.js             # EAR math (pure, no DOM)
│   ├── drowsinessStateMachine.js    # AWAKE→DROWSY→ASLEEP states (pure)
│   ├── faceLandmarker.js            # MediaPipe init + inference
│   └── webcamManager.js             # Camera permission + stream
├── alarm/
│   ├── AlarmOverlay.js              # Full-screen overlay + playlist + buzzer
│   └── DismissalFlow.js             # 3-click + eye-check (pure)
├── settings/
│   ├── SettingsStore.js             # localStorage CRUD
│   ├── PlaylistEditor.js            # Settings/playlist UI
│   └── CalibrationFlow.js           # Auto-tune EAR threshold (pure)
├── ui/
│   └── StatusBadge.js               # Live status indicator
└── __tests__/                       # 48 unit tests (Vitest + jsdom)
    ├── earCalculator.test.js
    ├── drowsinessStateMachine.test.js
    ├── dismissalFlow.test.js
    ├── settingsStore.test.js
    └── calibrationFlow.test.js
```

**Design principle**: The 3 core modules (`earCalculator`, `drowsinessStateMachine`, `DismissalFlow`) are pure logic with no DOM dependencies — fully unit-testable without a browser.

## Architecture

```
┌─────────────────────────────────────────────┐
│                 main.js                      │
│  webcam → MediaPipe → EAR → state machine   │
│       ↓              ↓          ↓            │
│  detectFrame()   computeFaceEAR()  update()  │
│                                  ↓            │
│                        ┌─────────┴────────┐  │
│                        │  AWAKE  DROWSY   │  │
│                        │    ↓       ↓     │  │
│                        │  (normal) ASLEEP │  │
│                        │           ↓      │  │
│                        │    triggerAlarm() │  │
│                        └──────────────────┘  │
│                                  ↓            │
│  ┌────────────────────────────────────────┐  │
│  │ AlarmOverlay: buzzer + video + UI      │  │
│  │ DismissalFlow: 3-click + eye verify    │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Background Tab Behavior

| Signal | Background tab? | How |
|--------|----------------|-----|
| Drowsiness detection | ✅ | `setInterval` fallback (10fps) |
| Buzzer sound | ✅ | Web Audio API oscillator |
| System notification | ✅ | Notifications API |
| Video playback | ❌ | Browser blocks autoplay — resumes on tab focus |

## Settings

All persisted in localStorage:

| Setting | Default | Range |
|---------|---------|-------|
| EAR Threshold | 0.21 | 0.10–0.35 |
| Drowsy Duration | 2500ms | 500–10000ms |
| Camera Device | System default | Select from available |
| Playlist | 3 YouTube videos | YouTube URLs + local files |

Run **Calibration** in Settings to auto-tune the EAR threshold for your face/lighting.

## Privacy

All video processing happens locally in your browser. No video frames or images are ever uploaded or sent anywhere. The MediaPipe model loads from Google's CDN on first use, then is cached by the browser.

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome / Edge | ✅ Recommended | Best MediaPipe + Web Audio + Notifications |
| Firefox | ⚠️ Basic | No File System Access API for local videos |
| Safari | ⚠️ Limited | MediaPipe support varies |

Requires **HTTPS** for camera access (all hosting providers provide this).

## Why a Web App, Not a Browser Extension?

Manifest V3 extensions run detection logic in a service worker, which has no persistent DOM or camera access. Continuous webcam-based face tracking needs a long-lived page context. This standalone web app (pinned browser tab) is simpler, more reliable, and avoids MV3 permission constraints.

## Tech Stack

- **Face tracking**: `@mediapipe/tasks-vision` (client-side ML)
- **Build**: Vite
- **Tests**: Vitest + jsdom (48 tests)
- **Storage**: localStorage (no backend)
- **Deployment**: Static files (Vercel, Netlify, GitHub Pages)

## License

MIT
