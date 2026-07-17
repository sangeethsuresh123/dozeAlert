# DozeAlert — Webcam Drowsiness Detector

A web application that detects when you've fallen asleep using your webcam and plays a motivational video playlist until you prove you're awake.

## How It Works

1. **Face Tracking**: Uses [MediaPipe FaceLandmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) to detect 478 face landmarks in real-time via your webcam.
2. **Eye Aspect Ratio (EAR)**: Computes a ratio of vertical-to-horizontal eye distances. EAR drops sharply when eyes close.
3. **Drowsiness Detection**: If EAR stays below a threshold for a configurable duration (default 2.5s), the alarm triggers.
4. **Anti-groggy Dismissal**: To dismiss the alarm, you must click "I'm awake" 3 times (1s apart) AND keep your eyes open for 3 seconds during live verification.

## Tech Stack

- **Face tracking**: `@mediapipe/tasks-vision` (runs fully client-side, no server needed)
- **Build**: Vite
- **Tests**: Vitest + jsdom
- **Storage**: localStorage (no backend)

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 in **Chrome or Edge** (best MediaPipe support).

### First Run

1. Click **Start Tracking**
2. Allow camera access when prompted
3. (Optional) Run calibration in Settings for better accuracy

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |

## Project Structure

```
/src
  /tracking
    earCalculator.js        # EAR math from landmark points
    drowsinessStateMachine.js # AWAKE/DROWSY_PENDING/ASLEEP states
    faceLandmarker.js       # MediaPipe init + frame loop
    webcamManager.js        # Camera permission + stream lifecycle
  /alarm
    AlarmOverlay.js         # Full overlay UI + playlist player
    DismissalFlow.js        # 3-click + eye-check state machine
  /settings
    SettingsStore.js        # localStorage read/write
    PlaylistEditor.js       # Settings/playlist UI
    CalibrationFlow.js      # Auto-tune EAR threshold
  /ui
    StatusBadge.js          # Live status indicator
  __tests__/
    earCalculator.test.js
    drowsinessStateMachine.test.js
    dismissalFlow.test.js
    settingsStore.test.js
    calibrationFlow.test.js
  main.js                   # Entry point, wires everything together
  styles.css
index.html
```

## Privacy

All video processing happens locally in your browser. No video frames or images are ever uploaded or sent anywhere. This is implemented — not just a claim.

## Browser Support

- **Chrome / Edge**: Recommended (best MediaPipe + File System Access API support)
- **Firefox**: Basic support (no File System Access API for local video files)
- **Safari**: Limited (MediaPipe support varies)

## Configuration

All settings are persisted in localStorage:

- **EAR Threshold**: 0.10–0.35 (default 0.21, or auto-calibrated)
- **Drowsy Duration**: 500–10000ms (default 2500ms)
- **Camera Device**: Select from available webcams
- **Playlist**: YouTube URLs or locally uploaded video files

## Default Playlist

Ships with 3 royalty-free YouTube videos. Add your own via the Settings panel.

## Chrome Extension (Stretch Goal)

This app is designed as a standalone web app because Manifest V3 service workers cannot maintain persistent camera access. An MV3 extension wrapper using `chrome.offscreen` API is possible but has known limitations (offscreen documents can be killed after ~30s of inactivity).

## License

MIT
