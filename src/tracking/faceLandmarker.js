/**
 * MediaPipe FaceLandmarker wrapper.
 *
 * Loads the FaceLandmarker model and runs inference on video frames.
 * Exposes a simple API: init(), detect(videoFrame), destroy().
 *
 * MediaPipe tasks-vision loads WASM + a model file (~5MB) on first init.
 * We use the CDN-hosted model for simplicity (no local file serving needed).
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

let faceLandmarker = null

/**
 * Initialize the FaceLandmarker. Call once on app startup.
 * @returns {Promise<void>}
 */
export async function initFaceLandmarker() {
  if (faceLandmarker) return

  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
  )

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'GPU',
    },
    outputFaceBlendshapes: false,
    runningMode: 'VIDEO',
    numFaces: 1,
  })
}

/**
 * Detect face landmarks from a video frame.
 * @param {HTMLVideoElement|HTMLCanvasElement} videoElement
 * @param {number} timestamp - Frame timestamp in ms
 * @returns {Object|null} - { landmarks: Array, faceDetected: boolean }
 */
export function detectLandmarks(videoElement, timestamp) {
  if (!faceLandmarker) {
    return { landmarks: [], faceDetected: false }
  }

  try {
    const results = faceLandmarker.detectForVideo(videoElement, timestamp)

    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      return {
        landmarks: results.faceLandmarks[0], // first face
        faceDetected: true,
      }
    }

    return { landmarks: [], faceDetected: false }
  } catch {
    return { landmarks: [], faceDetected: false }
  }
}

/**
 * Destroy the FaceLandmarker and free resources.
 */
export function destroyFaceLandmarker() {
  if (faceLandmarker) {
    faceLandmarker.close()
    faceLandmarker = null
  }
}

/**
 * Check if the FaceLandmarker is initialized.
 */
export function isInitialized() {
  return faceLandmarker !== null
}
