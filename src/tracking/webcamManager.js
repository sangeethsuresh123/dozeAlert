/**
 * Webcam manager.
 *
 * Handles camera permission, device selection, and stream lifecycle.
 * Exposes: startCamera(), stopCamera(), switchCamera(), getStream().
 */

let currentStream = null
let currentDeviceId = null

/**
 * Start the camera with the given device ID (or default).
 * @param {string|null} deviceId
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(deviceId = null) {
  if (currentStream) {
    stopCamera()
  }

  const constraints = {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user',
    },
    audio: false,
  }

  if (deviceId) {
    constraints.video.deviceId = { exact: deviceId }
  }

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints)
    currentDeviceId = deviceId
    return currentStream
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Camera permission denied. Please allow camera access and reload.')
    }
    if (err.name === 'NotFoundError') {
      throw new Error('No camera found. Please connect a camera and reload.')
    }
    if (err.name === 'OverconstrainedError' && deviceId) {
      // Fallback: try without specific device
      return startCamera(null)
    }
    throw err
  }
}

/**
 * Stop the current camera stream.
 */
export function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop())
    currentStream = null
    currentDeviceId = null
  }
}

/**
 * Switch to a different camera device.
 * @param {string} deviceId
 * @returns {Promise<MediaStream>}
 */
export async function switchCamera(deviceId) {
  return startCamera(deviceId)
}

/**
 * Get the current MediaStream.
 */
export function getStream() {
  return currentStream
}

/**
 * Get the current device ID.
 */
export function getCurrentDeviceId() {
  return currentDeviceId
}

/**
 * List available video input devices.
 * @returns {Promise<Array<{deviceId: string, label: string}>>}
 */
export async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter(d => d.kind === 'videoinput')
      .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` }))
  } catch {
    return []
  }
}
