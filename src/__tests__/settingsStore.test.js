import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, clearSettings, getSetting, setSetting } from '../settings/SettingsStore.js'

describe('SettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loadSettings() returns defaults when localStorage is empty', () => {
    const settings = loadSettings()
    expect(settings.earThreshold).toBe(0.21)
    expect(settings.drowsyDurationMs).toBe(2500)
    expect(settings.playlist).toBeInstanceOf(Array)
    expect(settings.playlist.length).toBeGreaterThan(0)
    expect(settings.hasCompletedCalibration).toBe(false)
  })

  it('saveSettings() persists and loadSettings() retrieves', () => {
    saveSettings({ earThreshold: 0.15 })
    const settings = loadSettings()
    expect(settings.earThreshold).toBe(0.15)
    // Other defaults still present
    expect(settings.drowsyDurationMs).toBe(2500)
  })

  it('saveSettings() merges with existing settings', () => {
    saveSettings({ earThreshold: 0.15 })
    saveSettings({ drowsyDurationMs: 3000 })
    const settings = loadSettings()
    expect(settings.earThreshold).toBe(0.15)
    expect(settings.drowsyDurationMs).toBe(3000)
  })

  it('clearSettings() removes saved data', () => {
    saveSettings({ earThreshold: 0.15 })
    clearSettings()
    const settings = loadSettings()
    expect(settings.earThreshold).toBe(0.21) // back to default
  })

  it('getSetting() retrieves a single value', () => {
    expect(getSetting('earThreshold')).toBe(0.21)
    saveSettings({ earThreshold: 0.15 })
    expect(getSetting('earThreshold')).toBe(0.15)
  })

  it('setSetting() persists a single value', () => {
    setSetting('earThreshold', 0.18)
    expect(getSetting('earThreshold')).toBe(0.18)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('dozealert_settings', '{invalid json')
    const settings = loadSettings()
    expect(settings.earThreshold).toBe(0.21) // falls back to defaults
  })

  it('playlist can be updated', () => {
    const newPlaylist = [
      { type: 'youtube', videoId: 'abc123', title: 'Test Video' },
    ]
    saveSettings({ playlist: newPlaylist })
    expect(getSetting('playlist')).toEqual(newPlaylist)
  })
})
