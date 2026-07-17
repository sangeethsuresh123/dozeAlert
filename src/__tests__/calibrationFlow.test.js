import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCalibrationFlow } from '../settings/CalibrationFlow.js'

describe('CalibrationFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in idle phase', () => {
    const flow = createCalibrationFlow({})
    expect(flow.getPhase()).toBe('idle')
  })

  it('transitions to open_eyes on start()', () => {
    const onProgress = vi.fn()
    const flow = createCalibrationFlow({ onProgress })
    flow.start()
    expect(flow.getPhase()).toBe('open_eyes')
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'open_eyes' })
    )
  })

  it('transitions to closed_eyes after 5 seconds', () => {
    const onProgress = vi.fn()
    const flow = createCalibrationFlow({ onProgress })
    flow.start()

    vi.advanceTimersByTime(5000)

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'closed_eyes' })
    )
  })

  it('completes after closed_eyes phase ends (8 seconds total)', () => {
    const onComplete = vi.fn()
    const flow = createCalibrationFlow({ onComplete })
    flow.start()

    flow.addSample(0.30)
    flow.addSample(0.32)
    flow.addSample(0.28)

    vi.advanceTimersByTime(5000)

    flow.addSample(0.05)
    flow.addSample(0.04)
    flow.addSample(0.06)

    vi.advanceTimersByTime(3000)

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        openEAR: expect.closeTo(0.30, 1),
        closedEAR: expect.closeTo(0.05, 1),
        threshold: expect.closeTo(0.175, 1),
      })
    )
  })

  it('uses fallback values when no samples collected', () => {
    const onComplete = vi.fn()
    const flow = createCalibrationFlow({ onComplete })
    flow.start()

    vi.advanceTimersByTime(8000)

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        openEAR: 0.30,
        closedEAR: 0.05,
        threshold: expect.closeTo(0.175, 1),
      })
    )
  })

  it('cancel() stops the calibration', () => {
    const onComplete = vi.fn()
    const flow = createCalibrationFlow({ onComplete })
    flow.start()
    flow.cancel()
    expect(flow.getPhase()).toBe('idle')

    vi.advanceTimersByTime(10000)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('clamps threshold to [0.10, 0.35]', () => {
    const onComplete = vi.fn()
    const flow = createCalibrationFlow({ onComplete })
    flow.start()

    flow.addSample(0.40)
    flow.addSample(0.42)

    vi.advanceTimersByTime(5000)

    flow.addSample(0.38)
    flow.addSample(0.36)

    vi.advanceTimersByTime(3000)

    const result = onComplete.mock.calls[0][0]
    expect(result.threshold).toBeLessThanOrEqual(0.35)
    expect(result.threshold).toBeGreaterThanOrEqual(0.10)
  })
})
