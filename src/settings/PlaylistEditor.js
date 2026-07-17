/**
 * Playlist editor UI.
 *
 * Allows adding/removing/reordering YouTube URLs and local video files.
 * Persists to SettingsStore.
 */

import { loadSettings, saveSettings } from './SettingsStore.js'

/**
 * Create the settings panel.
 * @returns {{ element: HTMLElement, show: Function, hide: Function }}
 */
export function createSettingsPanel() {
  const panel = document.createElement('div')
  panel.id = 'settings-panel'
  panel.className = 'settings-panel hidden'

  let settings = loadSettings()

  function render() {
    settings = loadSettings()

    panel.innerHTML = `
      <div class="settings-content">
        <div class="settings-header">
          <h2>Settings</h2>
          <button class="settings-close" id="settings-close">&times;</button>
        </div>

        <div class="settings-section">
          <h3>Detection</h3>
          <label>
            EAR Threshold: <span id="threshold-value">${settings.earThreshold}</span>
            <input type="range" id="ear-threshold" min="0.10" max="0.35" step="0.01"
              value="${settings.earThreshold}">
          </label>
          <label>
            Drowsy Duration (ms):
            <input type="number" id="drowsy-duration" min="500" max="10000" step="100"
              value="${settings.drowsyDurationMs}">
          </label>
          <button id="run-calibration" class="btn">Run Calibration</button>
        </div>

        <div class="settings-section">
          <h3>Camera</h3>
          <select id="camera-select" class="settings-select">
            <option value="">Default camera</option>
          </select>
        </div>

        <div class="settings-section">
          <h3>Playlist</h3>
          <div id="playlist-items" class="playlist-items"></div>
          <div class="playlist-add">
            <input type="text" id="youtube-url" placeholder="YouTube URL or video ID"
              class="settings-input">
            <button id="add-youtube" class="btn btn-small">+ YouTube</button>
          </div>
          <div class="playlist-add">
            <label class="btn btn-small file-label">
              + Local Video
              <input type="file" id="add-local" accept="video/*" style="display:none">
            </label>
          </div>
        </div>

        <div class="settings-section">
          <button id="reset-settings" class="btn btn-danger">Reset All Settings</button>
        </div>

        <div class="settings-privacy">
          <p>🔒 All video processing happens locally in your browser. No video frames or images are ever uploaded or sent anywhere.</p>
        </div>
      </div>
    `

    renderPlaylist()
    populateCameraSelect()
    bindEvents()
  }

  function renderPlaylist() {
    const container = panel.querySelector('#playlist-items')
    if (!container) return
    container.innerHTML = ''

    settings.playlist.forEach((item, index) => {
      const row = document.createElement('div')
      row.className = 'playlist-row'
      row.draggable = true
      row.dataset.index = index
      row.innerHTML = `
        <span class="drag-handle">⠿</span>
        <span class="playlist-title">${item.title || item.videoId || 'Untitled'}</span>
        <span class="playlist-type">${item.type}</span>
        <button class="btn-tiny btn-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-tiny btn-down" data-index="${index}" ${index === settings.playlist.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn-tiny btn-remove" data-index="${index}">&times;</button>
      `
      container.appendChild(row)
    })
  }

  function populateCameraSelect() {
    const select = panel.querySelector('#camera-select')
    if (!select || !navigator.mediaDevices) return

    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      select.innerHTML = '<option value="">Default camera</option>'
      videoDevices.forEach(d => {
        const opt = document.createElement('option')
        opt.value = d.deviceId
        opt.textContent = d.label || `Camera ${d.deviceId.slice(0, 8)}`
        if (d.deviceId === settings.cameraDeviceId) opt.selected = true
        select.appendChild(opt)
      })
    }).catch(() => {
      // Ignore
    })
  }

  function bindEvents() {
    panel.querySelector('#settings-close')?.addEventListener('click', hide)

    panel.querySelector('#ear-threshold')?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value)
      panel.querySelector('#threshold-value').textContent = val.toFixed(2)
      saveSettings({ earThreshold: val })
    })

    panel.querySelector('#drowsy-duration')?.addEventListener('change', (e) => {
      saveSettings({ drowsyDurationMs: parseInt(e.target.value, 10) })
    })

    panel.querySelector('#camera-select')?.addEventListener('change', (e) => {
      saveSettings({ cameraDeviceId: e.target.value || null })
    })

    panel.querySelector('#add-youtube')?.addEventListener('click', () => {
      const input = panel.querySelector('#youtube-url')
      const raw = input.value.trim()
      if (!raw) return

      const videoId = extractYouTubeId(raw)
      if (!videoId) {
        alert('Invalid YouTube URL or video ID')
        return
      }

      settings.playlist.push({
        type: 'youtube',
        videoId,
        title: `YouTube: ${videoId}`,
      })
      saveSettings({ playlist: settings.playlist })
      input.value = ''
      renderPlaylist()
    })

    panel.querySelector('#add-local')?.addEventListener('change', (e) => {
      const file = e.target.files[0]
      if (!file) return

      const objectUrl = URL.createObjectURL(file)
      settings.playlist.push({
        type: 'local',
        objectUrl,
        title: file.name,
      })
      saveSettings({ playlist: settings.playlist })
      renderPlaylist()
    })

    // Remove, up, down buttons (event delegation)
    panel.querySelector('#playlist-items')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-index]')
      if (!btn) return

      const index = parseInt(btn.dataset.index, 10)

      if (btn.classList.contains('btn-remove')) {
        settings.playlist.splice(index, 1)
        saveSettings({ playlist: settings.playlist })
        renderPlaylist()
      } else if (btn.classList.contains('btn-up') && index > 0) {
        ;[settings.playlist[index - 1], settings.playlist[index]] =
          [settings.playlist[index], settings.playlist[index - 1]]
        saveSettings({ playlist: settings.playlist })
        renderPlaylist()
      } else if (btn.classList.contains('btn-down') && index < settings.playlist.length - 1) {
        ;[settings.playlist[index], settings.playlist[index + 1]] =
          [settings.playlist[index + 1], settings.playlist[index]]
        saveSettings({ playlist: settings.playlist })
        renderPlaylist()
      }
    })

    panel.querySelector('#run-calibration')?.addEventListener('click', () => {
      hide()
      document.dispatchEvent(new CustomEvent('start-calibration'))
    })

    panel.querySelector('#reset-settings')?.addEventListener('click', () => {
      if (confirm('Reset all settings to defaults?')) {
        localStorage.removeItem('dozealert_settings')
        render()
      }
    })
  }

  function show() {
    render()
    panel.classList.remove('hidden')
    panel.style.display = 'flex'
  }

  function hide() {
    panel.classList.add('hidden')
    panel.style.display = 'none'
  }

  return { element: panel, show, hide, render }
}

/**
 * Extract YouTube video ID from URL or bare ID.
 */
function extractYouTubeId(input) {
  // Already a bare ID (11 chars, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input
  }

  // Try various URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match) return match[1]
  }

  return null
}
