const toggle = document.getElementById('toggle') as HTMLInputElement
const badge = document.getElementById('status-badge') as HTMLElement
const platformEl = document.getElementById('platform') as HTMLElement
const cameraStatus = document.getElementById('camera-status') as HTMLElement
const gestureDisplay = document.getElementById('current-gesture') as HTMLElement

function getPlatform(url: string): string {
  if (url.includes('youtube.com/shorts')) return 'youtube shorts'
  if (url.includes('instagram.com/reel')) return 'instagram reels'
  if (url.includes('tiktok.com')) return 'tiktok'
  return 'not supported'
}

function setBadge(state: 'on' | 'off' | 'error'): void {
  badge.className = 'badge'
  if (state === 'on') badge.classList.add('badge--on')
  badge.textContent = state
}

async function queryState(): Promise<{ platform: string; enabled: boolean }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url ?? ''
  const platform = getPlatform(url)

  const res = await chrome.runtime.sendMessage({ type: 'GET_ENABLED' }).catch(() => ({ enabled: false }))
  const enabled = res?.enabled ?? false

  return { platform, enabled }
}

async function init(): Promise<void> {
  const { platform, enabled } = await queryState()

  toggle.checked = enabled
  setBadge(enabled ? 'on' : 'off')
  platformEl.textContent = platform

  if (platform === 'not supported') {
    cameraStatus.textContent = '—'
    gestureDisplay.textContent = '—'
  } else if (enabled) {
    cameraStatus.textContent = 'starting...'
    gestureDisplay.textContent = 'listening...'
  } else {
    cameraStatus.textContent = 'off'
    gestureDisplay.textContent = '—'
  }
}

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked

  if (enabled) {
    setBadge('on')
    cameraStatus.textContent = 'starting...'
  } else {
    setBadge('off')
    cameraStatus.textContent = 'off'
    gestureDisplay.textContent = '—'
  }

  await chrome.runtime.sendMessage({ type: 'SET_ENABLED', enabled }).catch(() => {})

  // After the message, the content script starts/stops the camera.
  // We'll update UI optimistically. Reality syncs on next popup open.
  if (enabled) {
    cameraStatus.textContent = 'requested'
    gestureDisplay.textContent = 'listening...'
  }
})

init()