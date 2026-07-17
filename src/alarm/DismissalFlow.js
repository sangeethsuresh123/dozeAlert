/**
 * Dismissal flow state machine.
 *
 * To dismiss the alarm the user must:
 *   1. Click "I'm awake" 3 times with ≥1s between clicks
 *   2. Keep eyes open (EAR above threshold) for 3 seconds during live verification
 *
 * If eyes drop below threshold during verification, the click counter resets to 0
 * and the whole dismissal sequence restarts.
 *
 * States:
 *   IDLE          — not dismissing (alarm not active or initial)
 *   CLICKING      — awaiting 3 clicks
 *   EYE_CHECK     — clicks done, verifying eyes are open
 *   DISMISSED     — verification passed, alarm can close
 */

export const DismissalState = {
  IDLE: 'IDLE',
  CLICKING: 'CLICKING',
  EYE_CHECK: 'EYE_CHECK',
  DISMISSED: 'DISMISSED',
}

/**
 * @param {Object} options
 * @param {number} options.requiredClicks - Number of clicks needed (default 3)
 * @param {number} options.minClickIntervalMs - Min time between clicks (default 1000)
 * @param {number} options.eyeCheckDurationMs - How long eyes must stay open (default 3000)
 * @param {number} options.awakeEarThreshold - EAR threshold for "eyes open" during verification
 * @param {Function} options.onStateChange - Callback(newState, oldState, meta)
 */
export function createDismissalFlow(options = {}) {
  const {
    requiredClicks = 3,
    minClickIntervalMs = 1000,
    eyeCheckDurationMs = 3000,
    awakeEarThreshold = 0.21,
    onStateChange = () => {},
  } = options

  let state = DismissalState.IDLE
  let clickCount = 0
  let lastClickTime = 0
  let eyeCheckStartTime = null

  function getState() {
    return state
  }

  function getClickCount() {
    return clickCount
  }

  function transition(newState, meta = {}) {
    const oldState = state
    if (oldState === newState) return
    state = newState
    onStateChange(newState, oldState, meta)
  }

  /**
   * Start the dismissal flow (called when alarm triggers).
   */
  function start() {
    clickCount = 0
    lastClickTime = 0
    eyeCheckStartTime = null
    transition(DismissalState.CLICKING, { requiredClicks })
  }

  /**
   * Register a click on the "I'm awake" button.
   * @param {number} [now] - Current timestamp (injectable for testing)
   * @returns {{ accepted: boolean, reason?: string }}
   */
  function click(now) {
    if (state === DismissalState.DISMISSED) {
      return { accepted: false, reason: 'already dismissed' }
    }
    if (state === DismissalState.EYE_CHECK) {
      return { accepted: false, reason: 'waiting for eye check' }
    }
    if (state === DismissalState.IDLE) {
      return { accepted: false, reason: 'not active' }
    }

    // State is CLICKING
    if (clickCount > 0 && now - lastClickTime < minClickIntervalMs) {
      return { accepted: false, reason: 'click too fast' }
    }

    clickCount++
    lastClickTime = now

    if (clickCount >= requiredClicks) {
      eyeCheckStartTime = now
      transition(DismissalState.EYE_CHECK, { clickCount })
      return { accepted: true }
    }

    return { accepted: true }
  }

  /**
   * Feed EAR value during EYE_CHECK state.
   * @param {number} ear - Current EAR
   * @param {number} [now] - Current timestamp
   * @returns {{ passed: boolean, failed?: boolean, remainingMs?: number }}
   */
  function updateEyeCheck(ear, now) {
    if (state !== DismissalState.EYE_CHECK) {
      return { passed: false }
    }

    if (ear < awakeEarThreshold) {
      // Eyes closed → reset everything
      clickCount = 0
      eyeCheckStartTime = null
      transition(DismissalState.CLICKING, { reason: 'eyes closed during verification' })
      return { passed: false, failed: true }
    }

    const elapsed = now - eyeCheckStartTime
    const remainingMs = eyeCheckDurationMs - elapsed

    if (remainingMs <= 0) {
      transition(DismissalState.DISMISSED, { eyeCheckDurationMs: elapsed })
      return { passed: true }
    }

    return { passed: false, remainingMs }
  }

  /**
   * Reset the flow back to IDLE.
   */
  function reset() {
    clickCount = 0
    lastClickTime = 0
    eyeCheckStartTime = null
    transition(DismissalState.IDLE)
  }

  return { getState, getClickCount, start, click, updateEyeCheck, reset }
}
