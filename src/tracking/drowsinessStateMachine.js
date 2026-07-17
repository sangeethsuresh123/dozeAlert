/**
 * Drowsiness state machine.
 *
 * States:
 *   AWAKE          — eyes open, tracking normally
 *   DROWSY_PENDING — EAR has dropped below threshold, timer running
 *   ASLEEP         — eyes closed long enough, alarm triggered
 *   LOST_TRACKING  — no face detected for >5 seconds
 *
 * Transition rules:
 *   AWAKE → DROWSY_PENDING: EAR < threshold
 *   DROWSY_PENDING → AWAKE: EAR returns above threshold (timer resets)
 *   DROWSY_PENDING → ASLEEP: EAR stays below threshold for `drowsyDuration` ms
 *   ASLEEP → AWAKE: user dismisses alarm (external action)
 *   ANY → LOST_TRACKING: no face for >lostFaceDuration ms
 *   LOST_TRACKING → AWAKE: face reappears
 */

export const State = {
  AWAKE: 'AWAKE',
  DROWSY_PENDING: 'DROWSY_PENDING',
  ASLEEP: 'ASLEEP',
  LOST_TRACKING: 'LOST_TRACKING',
}

/**
 * @param {Object} options
 * @param {number} options.earThreshold - EAR below which eyes are considered closed (default 0.21)
 * @param {number} options.drowsyDurationMs - How long EAR must stay below threshold before ASLEEP (default 2500)
 * @param {number} options.lostFaceDurationMs - How long without a face before LOST_TRACKING (default 5000)
 * @param {Function} options.onStateChange - Callback(newState, oldState, meta)
 */
export function createDrowsinessMachine(options = {}) {
  let earThreshold = options.earThreshold ?? 0.21
  let drowsyDurationMs = options.drowsyDurationMs ?? 2500
  const lostFaceDurationMs = options.lostFaceDurationMs ?? 5000
  const onStateChange = options.onStateChange ?? (() => {})

  let state = State.AWAKE
  let drowsyStartTime = null
  let lastFaceTime = Date.now()
  let closedDurationMs = 0

  function getState() {
    return state
  }

  function getClosedDurationMs() {
    return closedDurationMs
  }

  function transition(newState, meta = {}) {
    const oldState = state
    if (oldState === newState) return
    state = newState
    onStateChange(newState, oldState, meta)
  }

  /**
   * Feed a new EAR value. Call this every frame (~30fps).
   * @param {number} ear - Current EAR value
   * @param {boolean} faceDetected - Whether a face was detected in this frame
   * @param {number} [now] - Current timestamp (injectable for testing)
   */
  function update(ear, faceDetected, now = Date.now()) {
    if (!faceDetected) {
      // No face detected
      if (state === State.LOST_TRACKING) return

      if (now - lastFaceTime > lostFaceDurationMs) {
        drowsyStartTime = null
        closedDurationMs = 0
        transition(State.LOST_TRACKING, { lastFaceTime })
      }
      return
    }

    // Face is detected
    lastFaceTime = now

    // If we were in LOST_TRACKING, go back to AWAKE
    if (state === State.LOST_TRACKING) {
      drowsyStartTime = null
      closedDurationMs = 0
      transition(State.AWAKE)
      return
    }

    // Don't process EAR if we're already ASLEEP (alarm is playing)
    if (state === State.ASLEEP) return

    const eyesClosed = ear < earThreshold

    if (eyesClosed) {
      if (drowsyStartTime === null) {
        drowsyStartTime = now
        transition(State.DROWSY_PENDING, { ear, threshold: earThreshold })
      }
      closedDurationMs = now - drowsyStartTime

      if (closedDurationMs >= drowsyDurationMs) {
        transition(State.ASLEEP, { closedDurationMs, threshold: earThreshold })
      }
    } else {
      // Eyes opened — reset timer
      if (drowsyStartTime !== null) {
        drowsyStartTime = null
        closedDurationMs = 0
        transition(State.AWAKE, { ear })
      }
    }
  }

  /**
   * Called when the user dismisses the alarm.
   */
  function dismiss() {
    if (state !== State.ASLEEP) return
    drowsyStartTime = null
    closedDurationMs = 0
    transition(State.AWAKE)
  }

  /**
   * Update configuration at runtime.
   */
  function configure({ earThreshold: newThreshold, drowsyDurationMs: newDuration }) {
    if (newThreshold !== undefined) earThreshold = newThreshold
    if (newDuration !== undefined) drowsyDurationMs = newDuration
  }

  return { getState, getClosedDurationMs, update, dismiss, configure }
}


