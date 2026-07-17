/**
 * DozeAlert — Main entry point.
 *
 * Wires together:
 *   - Webcam feed
 *   - MediaPipe FaceLandmarker
 *   - EAR calculation
 *   - Drowsiness state machine
 *   - Alarm overlay + dismissal flow
 *   - Settings panel
 *   - Calibration flow
 */

import { initFaceLandmarker, detectLandmarks } from './tracking/faceLandmarker.js'
import { computeFaceEAR, LEFT_EYE_INDICES, RIGHT_EYE_INDICES } from './tracking/earCalculator.js'
import { createDrowsinessMachine, State } from './tracking/drowsinessStateMachine.js'
import { startCamera, stopCamera, getStream } from './tracking/webcamManager.js'
import { createAlarmOverlay } from './alarm/AlarmOverlay.js'
import { createDismissalFlow, DismissalState } from './alarm/DismissalFlow.js'
import { createStatusBadge } from './ui/StatusBadge.js'
import { loadSettings, saveSettings } from './settings/SettingsStore.js'
import { createSettingsPanel } from './settings/PlaylistEditor.js'
import { createCalibrationFlow } from './settings/CalibrationFlow.js'

// --- DOM references ---
const videoEl = document.getElementById('webcam-video')
const canvasEl = document.getElementById('landmark-canvas')
const canvasCtx = canvasEl?.getContext('2d')
const startBtn = document.getElementById('start-btn')
const pauseBtn = document.getElementById('pause-btn')
const settingsBtn = document.getElementById('settings-btn')
const settingsContainer = document.getElementById('settings-container')
const alarmContainer = document.getElementById('alarm-container')
const errorBanner = document.getElementById('error-banner')

// --- State ---
let tracking = false
let animFrameId = null
let eyeCheckRunning = false
let machine = null
let dismissal = null
let alarmOverlay = null
let statusBadge = null
let calibrationFlow = null

// --- Initialize ---
async function init() {
  const settings = loadSettings()

  // Create components
  statusBadge = createStatusBadge()
  document.getElementById('status-container')?.appendChild(statusBadge.element)

  alarmOverlay = createAlarmOverlay()
  alarmContainer?.appendChild(alarmOverlay.element)

  const settingsPanel = createSettingsPanel()
  settingsContainer?.appendChild(settingsPanel.element)

  // Wire up settings button
  settingsBtn?.addEventListener('click', () => settingsPanel.show())

  // Wire up calibration event
  document.addEventListener('start-calibration', () => startCalibration())

  // Create state machine
  machine = createDrowsinessMachine({
    earThreshold: settings.earThreshold,
    drowsyDurationMs: settings.drowsyDurationMs,
    lostFaceDurationMs: settings.lostFaceDurationMs,
    onStateChange: handleStateChange,
  })

  // Create dismissal flow
  dismissal = createDismissalFlow({
    awakeEarThreshold: settings.earThreshold,
    onStateChange: handleDismissalStateChange,
  })

  // Wire up alarm button
  alarmOverlay.getAwakeButton()?.addEventListener('click', handleAwakeClick)

  // Start button
  startBtn?.addEventListener('click', startTracking)
  pauseBtn?.addEventListener('click', pauseTracking)

  // Show start state
  pauseBtn.style.display = 'none'

  console.log('DozeAlert initialized')
}

// --- Tracking ---

async function startTracking() {
  try {
    showError('')

    // Initialize MediaPipe
    statusBadge.update('INITIALIZING')
    await initFaceLandmarker()

    // Start camera
    const settings = loadSettings()
    const stream = await startCamera(settings.cameraDeviceId)
    videoEl.srcObject = stream
    await videoEl.play()

    // Size canvas to match video
    canvasEl.width = videoEl.videoWidth || 640
    canvasEl.height = videoEl.videoHeight || 480

    tracking = true
    startBtn.style.display = 'none'
    pauseBtn.style.display = 'inline-block'

    // Start frame loop
    detectFrame()
  } catch (err) {
    showError(err.message)
    statusBadge.update('ERROR')
  }
}

function pauseTracking() {
  tracking = false
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
  stopCamera()
  videoEl.srcObject = null
  startBtn.style.display = 'inline-block'
  pauseBtn.style.display = 'none'
  statusBadge.update('PAUSED')
}

function detectFrame() {
  if (!tracking) return

  const now = performance.now()
  const result = detectLandmarks(videoEl, now)

  if (result.faceDetected) {
    const ear = computeFaceEAR(result.landmarks)

    // Draw landmarks on canvas for debugging
    drawLandmarks(result.landmarks)

    // Feed to state machine
    machine.update(ear, true, now)
  } else {
    machine.update(0, false, now)
    clearCanvas()
  }

  animFrameId = requestAnimationFrame(detectFrame)
}

// --- State handling ---

function handleStateChange(newState, oldState, meta) {
  statusBadge.update(newState, meta)

  if (newState === State.ASLEEP && oldState !== State.ASLEEP) {
    triggerAlarm()
  }
}

function triggerAlarm() {
  alarmOverlay.show()
  alarmOverlay.startPlaylist()
  dismissal.start()
}

function handleDismissalStateChange(newState, oldState, meta) {
  const settings = loadSettings()

  switch (newState) {
    case DismissalState.CLICKING:
      alarmOverlay.updateClickCount(dismissal.getClickCount(), 3)
      alarmOverlay.hideEyeCheck()
      break

    case DismissalState.EYE_CHECK:
      alarmOverlay.updateClickCount(3, 3)
      alarmOverlay.showEyeCheck(getStream())
      break

    case DismissalState.DISMISSED:
      alarmOverlay.hide()
      alarmOverlay.hideEyeCheck()
      dismissal.reset()
      machine.dismiss()
      break
  }
}

async function handleAwakeClick() {
  const result = dismissal.click(performance.now())

  if (result.accepted) {
    const state = dismissal.getState()

    if (state === DismissalState.CLICKING) {
      alarmOverlay.updateClickCount(dismissal.getClickCount(), 3)
    } else if (state === DismissalState.EYE_CHECK) {
      // Start eye check loop
      startEyeCheckLoop()
    }
  }
}

function startEyeCheckLoop() {
  if (eyeCheckRunning) return
  eyeCheckRunning = true

  function checkFrame() {
    if (dismissal.getState() !== DismissalState.EYE_CHECK) {
      eyeCheckRunning = false
      return
    }

    const now = performance.now()
    const result = detectLandmarks(videoEl, now)

    if (result.faceDetected) {
      const ear = computeFaceEAR(result.landmarks)
      const checkResult = dismissal.updateEyeCheck(ear, now)

      const totalMs = 3000
      const elapsed = checkResult.remainingMs != null ? totalMs - checkResult.remainingMs : totalMs
      alarmOverlay.updateEyeCheckProgress(elapsed / totalMs)

      if (checkResult.failed) {
        alarmOverlay.updateClickCount(0, 3)
      }
      if (checkResult.passed) {
        eyeCheckRunning = false
        return
      }
    } else {
      dismissal.updateEyeCheck(0, now)
      alarmOverlay.updateClickCount(0, 3)
    }

    requestAnimationFrame(checkFrame)
  }

  requestAnimationFrame(checkFrame)
}

// --- Calibration ---

function startCalibration() {
  calibrationFlow = createCalibrationFlow({
    onProgress: (progress) => {
      statusBadge.update(`CALIBRATING: ${progress.phase}`, progress)
    },
    onComplete: (result) => {
      saveSettings({
        earThreshold: result.threshold,
        hasCompletedCalibration: true,
      })
      machine.configure({ earThreshold: result.threshold })
      statusBadge.update('AWAKE')
      alert(`Calibration complete!\nOpen-eye EAR: ${result.openEAR.toFixed(3)}\nClosed-eye EAR: ${result.closedEAR.toFixed(3)}\nThreshold: ${result.threshold.toFixed(3)}`)
    },
  })

  // Start camera for calibration if not already running
  startCamera().then(stream => {
    videoEl.srcObject = stream
    videoEl.play().then(() => {
      canvasEl.width = videoEl.videoWidth || 640
      canvasEl.height = videoEl.videoHeight || 480
      calibrationFlow.start()
      runCalibrationFrame()
    })
  })
}

function runCalibrationFrame() {
  if (!calibrationFlow || calibrationFlow.getPhase() === 'idle' || calibrationFlow.getPhase() === 'done') {
    return
  }

  const now = performance.now()
  const result = detectLandmarks(videoEl, now)

  if (result.faceDetected) {
    const ear = computeFaceEAR(result.landmarks)
    calibrationFlow.addSample(ear)
    drawLandmarks(result.landmarks)
  }

  requestAnimationFrame(runCalibrationFrame)
}

// --- Canvas drawing ---

function drawLandmarks(landmarks) {
  if (!canvasCtx) return

  canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height)

  const drawIndices = [...LEFT_EYE_INDICES, ...RIGHT_EYE_INDICES]

  canvasCtx.fillStyle = '#00ff00'
  canvasCtx.strokeStyle = '#00ff00'
  canvasCtx.lineWidth = 1

  for (const idx of drawIndices) {
    const pt = landmarks[idx]
    if (!pt) continue

    const x = pt.x * canvasEl.width
    const y = pt.y * canvasEl.height

    canvasCtx.beginPath()
    canvasCtx.arc(x, y, 2, 0, 2 * Math.PI)
    canvasCtx.fill()
  }
}

function clearCanvas() {
  if (!canvasCtx) return
  canvasCtx.clearRect(0, 0, canvasEl.width, canvasEl.height)
}

// --- Error display ---

function showError(message) {
  if (errorBanner) {
    errorBanner.textContent = message
    errorBanner.style.display = message ? 'block' : 'none'
  }
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', init)
