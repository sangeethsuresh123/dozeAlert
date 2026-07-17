/**
 * Eye Aspect Ratio (EAR) calculator.
 *
 * EAR formula (Soukupová & Čech, 2016):
 *   EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 * where p1..p6 are the 6 eye landmarks:
 *   p1 = outer corner, p2 = upper outer, p3 = upper inner,
 *   p4 = inner corner, p5 = lower inner, p6 = lower outer
 *
 * EAR drops sharply when the eye closes (vertical distances shrink
 * while horizontal distance stays roughly constant).
 *
 * MediaPipe FaceLandmarker returns 478 landmarks. For each eye we
 * use the indices from the canonical face mesh:
 *
 * Left eye:  33, 160, 158, 133, 153, 144
 * Right eye: 362, 385, 387, 263, 373, 380
 */

// Landmark indices for left and right eyes (MediaPipe canonical mesh)
export const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
export const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]

/**
 * Euclidean distance between two 2D points.
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {number}
 */
export function distance(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Compute EAR for a single eye given its 6 landmark points.
 * @param {Array<{x: number, y: number, z?: number}>} points - 6 landmark points
 * @returns {number} EAR value (0 = fully closed, ~0.3 = fully open)
 */
export function computeEyeEAR(points) {
  if (!points || points.length < 6) return 0

  const [p1, p2, p3, p4, p5, p6] = points

  const vertical1 = distance(p2, p6)
  const vertical2 = distance(p3, p5)
  const horizontal = distance(p1, p4)

  if (horizontal === 0) return 0

  return (vertical1 + vertical2) / (2 * horizontal)
}

/**
 * Compute the average EAR for both eyes from full face landmarks.
 * @param {Array<{x: number, y: number, z?: number}>} landmarks - All 478 face landmarks
 * @returns {number} Average EAR of left and right eyes
 */
export function computeFaceEAR(landmarks) {
  if (!landmarks || landmarks.length < 464) return 0

  const leftPoints = LEFT_EYE_INDICES.map(i => landmarks[i])
  const rightPoints = RIGHT_EYE_INDICES.map(i => landmarks[i])

  const leftEAR = computeEyeEAR(leftPoints)
  const rightEAR = computeEyeEAR(rightPoints)

  return (leftEAR + rightEAR) / 2
}
