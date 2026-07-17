/**
 * Alarm overlay UI.
 *
 * Renders a full-screen overlay with:
 *   - Video playlist player (YouTube or local video)
 *   - "I'm awake" button with click counter
 *   - Eye check verification feed
 *   - Explanation text (first time only)
 */

import { getSetting } from '../settings/SettingsStore.js'

/**
 * Create the alarm overlay DOM element.
 * @returns {{ element: HTMLElement, show: Function, hide: Function, updateClickCount: Function, showEyeCheck: Function, hideEyeCheck: Function }}
 */
export function createAlarmOverlay() {
  const overlay = document.createElement('div')
  overlay.id = 'alarm-overlay'
  overlay.className = 'alarm-overlay hidden'
  overlay.innerHTML = `
    <div class="alarm-backdrop"></div>
    <div class="alarm-content">
      <div class="alarm-header">
        <h2>⏰ WAKE UP!</h2>
        <div class="alarm-explanation" style="display:none">
          Click 3 times, then keep your eyes open for 3 seconds to dismiss.
        </div>
      </div>
      <div class="alarm-player" id="alarm-player">
        <div class="alarm-video-placeholder">Loading video...</div>
      </div>
      <div class="alarm-dismiss">
        <button id="awake-btn" class="awake-btn">I'm Awake!</button>
        <div id="click-counter" class="click-counter"></div>
      </div>
      <div id="eye-check-container" class="eye-check-container" style="display:none">
        <video id="eye-check-video" class="eye-check-video" autoplay muted playsinline></video>
        <div class="eye-check-status">Keep your eyes open...</div>
        <div class="eye-check-progress">
          <div class="eye-check-progress-bar" id="eye-check-bar"></div>
        </div>
      </div>
    </div>
  `

  const element = overlay
  const playerEl = overlay.querySelector('#alarm-player')
  const awakeBtn = overlay.querySelector('#awake-btn')
  const clickCounter = overlay.querySelector('#click-counter')
  const eyeCheckContainer = overlay.querySelector('#eye-check-container')
  const eyeCheckVideo = overlay.querySelector('#eye-check-video')
  const eyeCheckBar = overlay.querySelector('#eye-check-bar')
  const explanation = overlay.querySelector('.alarm-explanation')

  let currentVideoIndex = 0
  let playlist = []
  let youTubeIframe = null
  let localVideoEl = null
  let isPlaying = false
  let playInterval = null

  function show() {
    overlay.classList.remove('hidden')
    overlay.style.display = 'flex'
    // Show explanation on first trigger
    if (!getSetting('hasSeenDismissalInfo')) {
      explanation.style.display = 'block'
      import('../settings/SettingsStore.js').then(mod => {
        mod.setSetting('hasSeenDismissalInfo', true)
      })
    }
  }

  function hide() {
    overlay.classList.add('hidden')
    overlay.style.display = 'none'
    stopPlayback()
    explanation.style.display = 'none'
  }

  function updateClickCount(count, required) {
    if (count === 0) {
      clickCounter.textContent = ''
    } else {
      clickCounter.textContent = `Click ${count}/${required}`
    }
  }

  function showEyeCheck(videoStream) {
    eyeCheckContainer.style.display = 'flex'
    if (videoStream) {
      eyeCheckVideo.srcObject = videoStream
    }
    eyeCheckBar.style.width = '0%'
  }

  function updateEyeCheckProgress(progress) {
    // progress: 0 to 1
    eyeCheckBar.style.width = `${Math.min(100, progress * 100)}%`
  }

  function hideEyeCheck() {
    eyeCheckContainer.style.display = 'none'
    eyeCheckVideo.srcObject = null
    eyeCheckBar.style.width = '0%'
  }

  // --- Playlist playback ---

  function loadPlaylist(items) {
    playlist = items || []
    currentVideoIndex = 0
  }

  function stopPlayback() {
    isPlaying = false
    if (playInterval) {
      clearInterval(playInterval)
      playInterval = null
    }
    if (youTubeIframe) {
      youTubeIframe.remove()
      youTubeIframe = null
    }
    if (localVideoEl) {
      localVideoEl.pause()
      localVideoEl.src = ''
      localVideoEl.remove()
      localVideoEl = null
    }
  }

  function playCurrentItem() {
    stopPlayback()
    if (playlist.length === 0) {
      playerEl.innerHTML = '<div class="alarm-video-placeholder">No videos in playlist</div>'
      return
    }

    const item = playlist[currentVideoIndex % playlist.length]
    playerEl.innerHTML = ''

    if (item.type === 'youtube') {
      const iframe = document.createElement('iframe')
      iframe.width = '100%'
      iframe.height = '100%'
      iframe.src = `https://www.youtube.com/embed/${item.videoId}?autoplay=1&mute=0&loop=1&playlist=${item.videoId}`
      iframe.allow = 'autoplay; encrypted-media'
      iframe.allowFullscreen = true
      iframe.style.border = 'none'
      playerEl.appendChild(iframe)
      youTubeIframe = iframe
    } else if (item.type === 'local') {
      const video = document.createElement('video')
      video.src = item.objectUrl || item.url
      video.autoplay = true
      video.loop = true
      video.muted = false
      video.style.width = '100%'
      video.style.height = '100%'
      video.style.objectFit = 'contain'
      playerEl.appendChild(video)
      localVideoEl = video
    }

    isPlaying = true
  }

  function startPlaylist() {
    loadPlaylist(getSetting('playlist'))
    playCurrentItem()
  }

  function nextTrack() {
    if (playlist.length === 0) return
    currentVideoIndex = (currentVideoIndex + 1) % playlist.length
    playCurrentItem()
  }

  return {
    element,
    show,
    hide,
    updateClickCount,
    showEyeCheck,
    updateEyeCheckProgress,
    hideEyeCheck,
    startPlaylist,
    stopPlayback,
    nextTrack,
    getAwakeButton: () => awakeBtn,
    getEyeCheckVideo: () => eyeCheckVideo,
  }
}
