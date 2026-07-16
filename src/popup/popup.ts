const toggle = document.getElementById('toggle') as HTMLInputElement
const debugToggle = document.getElementById('debug-toggle') as HTMLInputElement
const badge = document.getElementById('status-badge') as HTMLElement
const platformEl = document.getElementById('platform') as HTMLElement
const cameraStatus = document.getElementById('camera-status') as HTMLElement
const gestureDisplay = document.getElementById('current-gesture') as HTMLElement
const supportHint = document.getElementById('support-hint') as HTMLElement

let currentPlatform = 'not supported'

type PopupState = {
  platform: string
  enabled: boolean
  camera: string
  gesture: string
  debug: boolean
}

function getPlatform(url: string): string {
  if (url.includes('youtube.com')) return 'youtube'
  if (url.includes('instagram.com')) return 'instagram'
  if (url.includes('tiktok.com')) return 'tiktok'
  return 'not supported'
}

function setBadge(state: 'on' | 'off' | 'error'): void {
  badge.className = 'badge'
  if (state === 'on') badge.classList.add('badge--on')
  badge.textContent = state
}

async function queryState(): Promise<PopupState> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url ?? ''
  const platform = getPlatform(url)
  currentPlatform = platform

  const enabledRes = await chrome.runtime.sendMessage({ type: 'GET_ENABLED' }).catch(() => ({ enabled: false }))
  const enabled = enabledRes?.enabled ?? false

  const debugRes = await chrome.storage.local.get('debug').catch(() => ({ debug: false }))
  const debug = debugRes?.debug === true

  let camera = '—'
  let gesture = '—'

  if (platform === 'not supported') {
    camera = 'not supported'
  } else {
    const tabStatus = tab?.id
      ? await chrome.tabs.sendMessage(tab.id, { type: 'GET_EXTENSION_STATUS' }).catch(() => null)
      : null

    if (tabStatus && typeof tabStatus === 'object') {
      if (tabStatus.running) {
        camera = 'running'
        gesture = 'listening...'
      } else if (tabStatus.starting) {
        camera = 'starting...'
      } else if (tabStatus.enabled) {
        camera = 'requested'
      } else {
        camera = 'off'
      }
    } else {
      camera = 'off'
    }
  }

  return { platform, enabled, camera, gesture, debug }
}

async function init(): Promise<void> {
  const { platform, enabled, camera, gesture, debug } = await queryState()

  toggle.checked = enabled
  toggle.disabled = platform === 'not supported'
  supportHint.style.display = platform === 'not supported' ? 'block' : 'none'
  debugToggle.checked = debug
  setBadge(enabled && platform !== 'not supported' ? 'on' : 'off')
  platformEl.textContent = platform
  cameraStatus.textContent = camera
  gestureDisplay.textContent = gesture

  if (platform !== 'not supported') {
    startStatusPolling()
  } else {
    stopStatusPolling()
  }
}

let pollInterval: number | null = null

function startStatusPolling(): void {
  stopStatusPolling()
  pollInterval = window.setInterval(async () => {
    await init()
  }, 1000)
}

function stopStatusPolling(): void {
  if (pollInterval !== null) {
    window.clearInterval(pollInterval)
    pollInterval = null
  }
}

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked

  if (enabled && currentPlatform === 'not supported') {
    toggle.checked = false
    setBadge('off')
    cameraStatus.textContent = 'not supported'
    gestureDisplay.textContent = '—'
    return
  }

  setBadge(enabled ? 'on' : 'off')
  await chrome.runtime.sendMessage({ type: 'SET_ENABLED', enabled }).catch(() => {})
})

debugToggle.addEventListener('change', async () => {
  const debug = debugToggle.checked
  await chrome.storage.local.set({ debug }).catch(() => {})
})

chrome.runtime.onMessage.addListener((msg, _sender) => {
  if (msg.type === 'EXTENSION_STATUS_UPDATE' && typeof msg.status === 'object') {
    const { platform, enabled, camera, gesture } = msg.status
    if (platform !== currentPlatform) return

    toggle.checked = enabled
    setBadge(enabled ? 'on' : 'off')
    platformEl.textContent = platform
    cameraStatus.textContent = camera
    gestureDisplay.textContent = gesture
  }
})

init()