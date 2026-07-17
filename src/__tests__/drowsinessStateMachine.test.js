import { describe, it, expect, vi } from 'vitest'
import { createDrowsinessMachine, State } from '../tracking/drowsinessStateMachine.js'

describe('DrowsinessStateMachine', () => {
  function createMachine(opts = {}) {
    const onStateChange = opts.onStateChange || vi.fn()
    return {
      machine: createDrowsinessMachine({
        earThreshold: 0.21,
        drowsyDurationMs: 1000,
        lostFaceDurationMs: 2000,
        ...opts,
        onStateChange,
      }),
      onStateChange,
    }
  }

  it('starts in AWAKE state', () => {
    const { machine } = createMachine()
    expect(machine.getState()).toBe(State.AWAKE)
  })

  it('transitions to DROWSY_PENDING when EAR drops below threshold', () => {
    const { machine, onStateChange } = createMachine()
    machine.update(0.15, true, 1000)
    expect(machine.getState()).toBe(State.DROWSY_PENDING)
    expect(onStateChange).toHaveBeenCalledWith(
      State.DROWSY_PENDING,
      State.AWAKE,
      expect.objectContaining({ ear: 0.15 })
    )
  })

  it('transitions back to AWAKE when EAR recovers', () => {
    const { machine, onStateChange } = createMachine()
    machine.update(0.15, true, 1000) // DROWSY_PENDING
    machine.update(0.30, true, 1100) // back to AWAKE
    expect(machine.getState()).toBe(State.AWAKE)
    expect(onStateChange).toHaveBeenCalledWith(
      State.AWAKE,
      State.DROWSY_PENDING,
      expect.any(Object)
    )
  })

  it('transitions to ASLEEP after sustained closed eyes', () => {
    const { machine, onStateChange } = createMachine()
    machine.update(0.15, true, 1000) // DROWSY_PENDING
    machine.update(0.15, true, 1500) // still below
    machine.update(0.15, true, 2001) // >1000ms elapsed → ASLEEP
    expect(machine.getState()).toBe(State.ASLEEP)
    expect(onStateChange).toHaveBeenCalledWith(
      State.ASLEEP,
      State.DROWSY_PENDING,
      expect.objectContaining({ closedDurationMs: expect.any(Number) })
    )
  })

  it('resets timer when eyes briefly open during DROWSY_PENDING', () => {
    const { machine } = createMachine()
    machine.update(0.15, true, 1000) // DROWSY_PENDING
    machine.update(0.15, true, 1500) // 500ms closed
    machine.update(0.30, true, 1600) // eyes open → reset
    machine.update(0.15, true, 2000) // DROWSY_PENDING again (fresh start)
    machine.update(0.15, true, 2500) // only 500ms since reset
    expect(machine.getState()).toBe(State.DROWSY_PENDING)
  })

  it('does not process EAR updates when ASLEEP', () => {
    const { machine } = createMachine()
    machine.update(0.15, true, 1000)
    machine.update(0.15, true, 2001) // ASLEEP
    machine.update(0.35, true, 3000) // eyes open but state stays ASLEEP
    expect(machine.getState()).toBe(State.ASLEEP)
  })

  it('dismiss() returns to AWAKE from ASLEEP', () => {
    const { machine } = createMachine()
    machine.update(0.15, true, 1000)
    machine.update(0.15, true, 2001) // ASLEEP
    machine.dismiss()
    expect(machine.getState()).toBe(State.AWAKE)
  })

  it('dismiss() does nothing if not ASLEEP', () => {
    const { machine, onStateChange } = createMachine()
    machine.dismiss()
    expect(machine.getState()).toBe(State.AWAKE)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('transitions to LOST_TRACKING when no face for too long', () => {
    const { machine } = createMachine()
    machine.update(0.30, true, 1000) // face present
    machine.update(0, false, 3001) // face lost > 2000ms
    expect(machine.getState()).toBe(State.LOST_TRACKING)
  })

  it('returns to AWAKE from LOST_TRACKING when face reappears', () => {
    const { machine } = createMachine()
    machine.update(0.30, true, 1000)
    machine.update(0, false, 3001) // LOST_TRACKING
    machine.update(0.30, true, 4000) // face back
    expect(machine.getState()).toBe(State.AWAKE)
  })

  it('reports correct closedDurationMs', () => {
    const { machine } = createMachine()
    machine.update(0.15, true, 1000)
    machine.update(0.15, true, 1500)
    expect(machine.getClosedDurationMs()).toBe(500)
  })

  it('configure() updates thresholds at runtime', () => {
    const { machine } = createMachine({ earThreshold: 0.21 })
    machine.update(0.18, true, 1000) // 0.18 < 0.21 → DROWSY_PENDING
    expect(machine.getState()).toBe(State.DROWSY_PENDING)

    // Configure new threshold on a fresh machine
    const m2 = createMachine({ earThreshold: 0.21 })
    m2.machine.configure({ earThreshold: 0.10 })
    m2.machine.update(0.15, true, 1000) // 0.15 > 0.10 → stays AWAKE
    expect(m2.machine.getState()).toBe(State.AWAKE)

    // Also test that new threshold triggers DROWSY_PENDING
    const m3 = createMachine({ earThreshold: 0.21 })
    m3.machine.configure({ earThreshold: 0.20 })
    m3.machine.update(0.18, true, 1000) // 0.18 < 0.20 → DROWSY_PENDING
    expect(m3.machine.getState()).toBe(State.DROWSY_PENDING)
  })
})
