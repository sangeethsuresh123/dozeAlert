import { describe, it, expect, vi } from 'vitest'
import { createDismissalFlow, DismissalState } from '../alarm/DismissalFlow.js'

describe('DismissalFlow', () => {
  function createFlow(opts = {}) {
    const onStateChange = opts.onStateChange || vi.fn()
    return {
      flow: createDismissalFlow({
        requiredClicks: 3,
        minClickIntervalMs: 1000,
        eyeCheckDurationMs: 2000,
        awakeEarThreshold: 0.21,
        ...opts,
        onStateChange,
      }),
      onStateChange,
    }
  }

  it('starts in IDLE state', () => {
    const { flow } = createFlow()
    expect(flow.getState()).toBe(DismissalState.IDLE)
  })

  it('start() transitions to CLICKING', () => {
    const { flow, onStateChange } = createFlow()
    flow.start()
    expect(flow.getState()).toBe(DismissalState.CLICKING)
    expect(onStateChange).toHaveBeenCalledWith(
      DismissalState.CLICKING,
      DismissalState.IDLE,
      expect.any(Object)
    )
  })

  it('accepts clicks with valid interval and counts them', () => {
    const { flow } = createFlow()
    flow.start()

    const r1 = flow.click(1000)
    expect(r1.accepted).toBe(true)
    expect(flow.getClickCount()).toBe(1)
    expect(flow.getState()).toBe(DismissalState.CLICKING)

    const r2 = flow.click(2500) // 1500ms later
    expect(r2.accepted).toBe(true)
    expect(flow.getClickCount()).toBe(2)

    const r3 = flow.click(4000) // 1500ms later
    expect(r3.accepted).toBe(true)
    expect(flow.getClickCount()).toBe(3)
    expect(flow.getState()).toBe(DismissalState.EYE_CHECK)
  })

  it('rejects clicks that are too fast', () => {
    const { flow } = createFlow()
    flow.start()

    flow.click(1000) // click 1
    const r2 = flow.click(1500) // only 500ms later
    expect(r2.accepted).toBe(false)
    expect(r2.reason).toBe('click too fast')
    expect(flow.getClickCount()).toBe(1) // count unchanged
  })

  it('rejects clicks when not in CLICKING state', () => {
    const { flow } = createFlow()
    const r = flow.click(1000)
    expect(r.accepted).toBe(false)
    expect(r.reason).toBe('not active')
  })

  it('passes eye check when eyes stay open long enough', () => {
    const { flow } = createFlow({ eyeCheckDurationMs: 2000 })
    flow.start()
    flow.click(1000)
    flow.click(2500)
    flow.click(4000) // enters EYE_CHECK

    const r1 = flow.updateEyeCheck(0.30, 4500) // 500ms into check
    expect(r1.passed).toBe(false)
    expect(r1.remainingMs).toBeGreaterThan(0)

    const r2 = flow.updateEyeCheck(0.30, 6001) // 2001ms > 2000ms
    expect(r2.passed).toBe(true)
    expect(flow.getState()).toBe(DismissalState.DISMISSED)
  })

  it('resets to CLICKING if eyes close during verification', () => {
    const { flow, onStateChange } = createFlow({ eyeCheckDurationMs: 2000 })
    flow.start()
    flow.click(1000)
    flow.click(2500)
    flow.click(4000) // enters EYE_CHECK

    const r = flow.updateEyeCheck(0.10, 4500) // eyes closed
    expect(r.passed).toBe(false)
    expect(r.failed).toBe(true)
    expect(flow.getState()).toBe(DismissalState.CLICKING)
    expect(flow.getClickCount()).toBe(0) // reset
    expect(onStateChange).toHaveBeenCalledWith(
      DismissalState.CLICKING,
      DismissalState.EYE_CHECK,
      expect.objectContaining({ reason: 'eyes closed during verification' })
    )
  })

  it('rejects clicks during EYE_CHECK', () => {
    const { flow } = createFlow()
    flow.start()
    flow.click(1000)
    flow.click(2500)
    flow.click(4000) // enters EYE_CHECK

    const r = flow.click(5000)
    expect(r.accepted).toBe(false)
    expect(r.reason).toBe('waiting for eye check')
  })

  it('reset() returns to IDLE from any state', () => {
    const { flow } = createFlow()
    flow.start()
    flow.click(1000)
    flow.reset()
    expect(flow.getState()).toBe(DismissalState.IDLE)
    expect(flow.getClickCount()).toBe(0)
  })

  it('rejects clicks after DISMISSED', () => {
    const { flow } = createFlow({ eyeCheckDurationMs: 100 })
    flow.start()
    flow.click(1000)
    flow.click(2500)
    flow.click(4000)
    flow.updateEyeCheck(0.30, 4200) // passes

    expect(flow.getState()).toBe(DismissalState.DISMISSED)
    const r = flow.click(5000)
    expect(r.accepted).toBe(false)
    expect(r.reason).toBe('already dismissed')
  })
})
