/**
 * Calibration flow.
 *
 * Asks the user to:
 *   1. Look at the camera normally for 5 seconds (measures open-eye EAR)
 *   2. Close eyes for 3 seconds (measures closed-eye EAR)
 *
 * Computes optimal threshold as midpoint between open and closed EAR.
 */

/**
 * @param {Function} onProgress - Callback({ phase, elapsed, total })
 * @param {Function} onComplete - Callback({ openEAR, closedEAR, threshold })
 */
export function createCalibrationFlow({ onProgress = () => {}, onComplete = () => {} } = {}) {
  let phase = 'idle' // idle | open_eyes | closed_eyes | done
  let samples = []
  let startTime = 0
  let timerInterval = null

  const OPEN_EYES_DURATION = 5000 // 5 seconds
  const CLOSED_EYES_DURATION = 3000 // 3 seconds

  const openEyeSamples = []
  const closedEyeSamples = []

  function start() {
    phase = 'open_eyes'
    startTime = Date.now()
    samples = []
    openEyeSamples.length = 0
    closedEyeSamples.length = 0

    onProgress({ phase, elapsed: 0, total: OPEN_EYES_DURATION })

    timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime

      if (phase === 'open_eyes') {
        onProgress({ phase, elapsed, total: OPEN_EYES_DURATION })
        if (elapsed >= OPEN_EYES_DURATION) {
          phase = 'closed_eyes'
          startTime = Date.now()
          onProgress({ phase, elapsed: 0, total: CLOSED_EYES_DURATION })
        }
      } else if (phase === 'closed_eyes') {
        onProgress({ phase, elapsed, total: CLOSED_EYES_DURATION })
        if (elapsed >= CLOSED_EYES_DURATION) {
          finish()
        }
      }
    }, 100)
  }

  /**
   * Feed EAR sample during calibration.
   * @param {number} ear
   */
  function addSample(ear) {
    if (phase === 'open_eyes') {
      openEyeSamples.push(ear)
    } else if (phase === 'closed_eyes') {
      closedEyeSamples.push(ear)
    }
  }

  function finish() {
    clearInterval(timerInterval)
    timerInterval = null
    phase = 'done'

    const avgOpen = openEyeSamples.length > 0
      ? openEyeSamples.reduce((a, b) => a + b, 0) / openEyeSamples.length
      : 0.30 // fallback

    const avgClosed = closedEyeSamples.length > 0
      ? closedEyeSamples.reduce((a, b) => a + b, 0) / closedEyeSamples.length
      : 0.05 // fallback

    // Threshold is midpoint, clamped to reasonable range
    const threshold = Math.max(0.10, Math.min(0.35, (avgOpen + avgClosed) / 2))

    onComplete({
      openEAR: avgOpen,
      closedEAR: avgClosed,
      threshold,
    })
  }

  function cancel() {
    clearInterval(timerInterval)
    timerInterval = null
    phase = 'idle'
  }

  function getPhase() {
    return phase
  }

  return { start, addSample, cancel, getPhase }
}
