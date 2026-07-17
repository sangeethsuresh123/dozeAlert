import { describe, it, expect } from 'vitest'
import {
  distance,
  computeEyeEAR,
  computeFaceEAR,
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
} from '../tracking/earCalculator.js'

describe('distance', () => {
  it('returns 0 for identical points', () => {
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0)
  })

  it('computes horizontal distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3)
  })

  it('computes vertical distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(4)
  })

  it('computes diagonal distance (3-4-5 triangle)', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('computeEyeEAR', () => {
  it('returns 0 for null/empty input', () => {
    expect(computeEyeEAR(null)).toBe(0)
    expect(computeEyeEAR([])).toBe(0)
  })

  it('returns 0 when horizontal distance is 0', () => {
    const points = [
      { x: 5, y: 0 }, // p1 (outer corner)
      { x: 5, y: -1 }, // p2 (upper outer)
      { x: 5, y: -1 }, // p3 (upper inner)
      { x: 5, y: 0 }, // p4 (inner corner) — same x as p1
      { x: 5, y: 1 }, // p5 (lower inner)
      { x: 5, y: 1 }, // p6 (lower outer)
    ]
    expect(computeEyeEAR(points)).toBe(0)
  })

  it('returns a high EAR (~0.3) for a wide-open eye', () => {
    // Simulate an open eye: horizontal = 10, vertical offsets = 3 each
    const points = [
      { x: 0, y: 0 }, // p1 outer corner
      { x: 3, y: -3 }, // p2 upper outer
      { x: 7, y: -3 }, // p3 upper inner
      { x: 10, y: 0 }, // p4 inner corner
      { x: 7, y: 3 }, // p5 lower inner
      { x: 3, y: 3 }, // p6 lower outer
    ]
    // vertical1 = dist(p2,p6) = dist((3,-3),(3,3)) = 6
    // vertical2 = dist(p3,p5) = dist((7,-3),(7,3)) = 6
    // horizontal = dist(p1,p4) = dist((0,0),(10,0)) = 10
    // EAR = (6 + 6) / (2 * 10) = 12/20 = 0.6
    const ear = computeEyeEAR(points)
    expect(ear).toBeCloseTo(0.6, 2)
  })

  it('returns a low EAR (~0.05) for a nearly-closed eye', () => {
    // Simulate closed eye: vertical offsets shrink to 0.25
    const points = [
      { x: 0, y: 0 },
      { x: 3, y: -0.25 },
      { x: 7, y: -0.25 },
      { x: 10, y: 0 },
      { x: 7, y: 0.25 },
      { x: 3, y: 0.25 },
    ]
    // vertical1 = 0.5, vertical2 = 0.5, horizontal = 10
    // EAR = (0.5 + 0.5) / 20 = 0.05
    const ear = computeEyeEAR(points)
    expect(ear).toBeCloseTo(0.05, 2)
  })
})

describe('computeFaceEAR', () => {
  function makeLandmarks(openFactor = 3) {
    const landmarks = new Array(478).fill(null).map(() => ({ x: 0, y: 0 }))

    // Fill left eye landmarks at their canonical indices
    const leftPositions = [
      { x: 0, y: 0 }, // 33
      { x: 3, y: -openFactor }, // 160
      { x: 7, y: -openFactor }, // 158
      { x: 10, y: 0 }, // 133
      { x: 7, y: openFactor }, // 153
      { x: 3, y: openFactor }, // 144
    ]
    LEFT_EYE_INDICES.forEach((idx, i) => {
      landmarks[idx] = leftPositions[i]
    })

    // Fill right eye landmarks
    const rightPositions = [
      { x: 20, y: 0 }, // 362
      { x: 23, y: -openFactor }, // 385
      { x: 27, y: -openFactor }, // 387
      { x: 30, y: 0 }, // 263
      { x: 27, y: openFactor }, // 373
      { x: 23, y: openFactor }, // 380
    ]
    RIGHT_EYE_INDICES.forEach((idx, i) => {
      landmarks[idx] = rightPositions[i]
    })

    return landmarks
  }

  it('returns 0 for insufficient landmarks', () => {
    expect(computeFaceEAR([])).toBe(0)
    expect(computeFaceEAR(null)).toBe(0)
  })

  it('returns high EAR when eyes are open', () => {
    const landmarks = makeLandmarks(3)
    const ear = computeFaceEAR(landmarks)
    expect(ear).toBeGreaterThan(0.2)
    expect(ear).toBeCloseTo(0.6, 1)
  })

  it('returns low EAR when eyes are closed', () => {
    const landmarks = makeLandmarks(0.25)
    const ear = computeFaceEAR(landmarks)
    expect(ear).toBeLessThan(0.1)
  })
})
