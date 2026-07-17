/**
 * Settings persistence using localStorage.
 *
 * Stores:
 *   - EAR threshold
 *   - Drowsy duration threshold
 *   - Camera device ID
 *   - Playlist items
 *   - Calibration data
 *   - First-run flag
 */

const STORAGE_KEY = 'dozealert_settings'

const DEFAULTS = {
  earThreshold: 0.21,
  drowsyDurationMs: 2500,
  lostFaceDurationMs: 5000,
  cameraDeviceId: null,
  playlist: [
    { type: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up' },
    { type: 'youtube', videoId: 'jNQXAC9IVRw', title: 'Me at the zoo' },
    { type: 'youtube', videoId: '9bZkp7q19f0', title: 'PSY - GANGNAM STYLE' },
  ],
  calibrationData: null,
  hasCompletedCalibration: false,
  hasSeenDismissalInfo: false,
}

/**
 * Load settings from localStorage, merging with defaults.
 */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const saved = JSON.parse(raw)
    return { ...DEFAULTS, ...saved }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * Save settings to localStorage.
 * @param {Object} settings - Partial settings to merge
 */
export function saveSettings(settings) {
  try {
    const current = loadSettings()
    const merged = { ...current, ...settings }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    return merged
  } catch {
    return null
  }
}

/**
 * Clear all saved settings (revert to defaults).
 */
export function clearSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}

/**
 * Get a single setting value.
 * @param {string} key
 */
export function getSetting(key) {
  const settings = loadSettings()
  return settings[key]
}

/**
 * Set a single setting value.
 * @param {string} key
 * @param {*} value
 */
export function setSetting(key, value) {
  return saveSettings({ [key]: value })
}
