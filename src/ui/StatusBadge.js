/**
 * Status badge component.
 * Shows current tracking state: "Tracking", "Drowsy — Xs", "No face", etc.
 */

/**
 * Create the status badge element.
 * @returns {{ element: HTMLElement, update: Function }}
 */
export function createStatusBadge() {
  const badge = document.createElement('div')
  badge.id = 'status-badge'
  badge.className = 'status-badge status-tracking'
  badge.textContent = 'Initializing...'

  function update(state, meta = {}) {
    badge.className = 'status-badge'

    switch (state) {
      case 'AWAKE':
        badge.classList.add('status-tracking')
        badge.textContent = '● Tracking'
        break
      case 'DROWSY_PENDING': {
        const elapsed = meta.closedDurationMs
          ? `${Math.round(meta.closedDurationMs / 1000)}s`
          : ''
        badge.classList.add('status-drowsy')
        badge.textContent = `⚠ Drowsy ${elapsed ? `— ${elapsed}` : ''}`
        break
      }
      case 'ASLEEP':
        badge.classList.add('status-asleep')
        badge.textContent = '🔴 ALARM'
        break
      case 'LOST_TRACKING':
        badge.classList.add('status-lost')
        badge.textContent = '◌ No face detected'
        break
      default:
        badge.textContent = state
    }
  }

  return { element: badge, update }
}
