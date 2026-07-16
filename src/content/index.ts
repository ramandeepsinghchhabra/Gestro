import { logger } from './logger';
import { startCamera, stopCamera } from './camera';
import { destroyMediaPipe } from './mediapipe';
import { GestureRecognizer } from './recognizer';
import { GestureStateMachine } from './state-machine';
import { HUD } from './hud';
import { detectPlatform, createAdapter, installSPAWatcher } from './platforms/index';

let enabled = false;
let running = false;
let starting = false;
let cameraState: 'off' | 'requested' | 'starting' | 'running' = 'off';
let gestureState = '—';
let platformName: string | null = null;
let hud: HUD | null = null;
const recognizer = new GestureRecognizer();
const fsm = new GestureStateMachine();

const SPA_RESTART_DELAY_MS = 800;
const SPA_RECOVERY_RETRY_MS = 3500;
let spaRestartTimeout: number | null = null;
let spaRecoveryTimeout: number | null = null;

function sendStatusUpdate(): void {
  chrome.runtime.sendMessage({
    type: 'EXTENSION_STATUS_UPDATE',
    status: {
      platform: platformName,
      enabled,
      running,
      starting,
      camera: cameraState,
      gesture: gestureState,
    }
  }).catch(() => {});
}

function setStatus(camera: 'off' | 'requested' | 'starting' | 'running', gesture: string): void {
  cameraState = camera;
  gestureState = gesture;
  sendStatusUpdate();
}

async function enable() {
  if (running || starting) {
    logger.info('INIT', 'Extension is already running or starting');
    return;
  }
  
  starting = true;
  logger.info('INIT', 'Enabling gesture extension...');
  installSPAWatcher();

  const platform = detectPlatform();
  platformName = platform;
  if (!platform) {
    logger.error('INIT', 'Not a supported platform');
    starting = false;
    setStatus('off', 'not supported');
    return;
  }

  setStatus('starting', '—');

  const adapter = createAdapter(platform);
  hud = new HUD();
  hud.update('LOADING', 'NONE');

  try {
    await startCamera((result) => {
      const recognition = recognizer.recognize(result.landmarks ?? [], result.brightness);
      const output = fsm.update(recognition.gesture, performance.now());

      const warningMessage = recognition.reason === 'LOW_LIGHT'
        ? 'low light detected'
        : undefined;

      hud?.update(output.state, output.gesture, undefined, warningMessage);

      const statusGesture = output.gesture === 'NONE' ? 'listening...' : output.gesture;
      if (statusGesture !== gestureState) {
        gestureState = statusGesture;
        sendStatusUpdate();
      }

      if (output.shouldFire) {
        if (output.gesture === 'NEXT') adapter.next();
        if (output.gesture === 'PREV') adapter.previous();
        if (output.gesture === 'PAUSE') {
          adapter.togglePause();
          const video = adapter.getCurrentVideo();
          const isPaused = video ? video.paused : true;
          hud?.update('TRIGGERED', 'PAUSE', undefined, undefined, isPaused ? '⏸ PAUSED' : '▶ RESUMED');
        }
        if (output.gesture === 'SPEED') {
          adapter.toggleSpeed();
          const video = adapter.getCurrentVideo();
          const playbackRate = video ? Number(video.playbackRate.toFixed(2)) : 1;
          const speedLabel = playbackRate > 1 ? `⚡ ${playbackRate}X SPEED` : '▶ NORMAL SPEED';
          hud?.update('TRIGGERED', 'SPEED', undefined, undefined, speedLabel);
        }
        if (output.gesture === 'EXIT') {
          hud?.update('TRIGGERED', 'EXIT');
          // Immediately stop capturing frames
          stopCamera();
          chrome.storage.local.set({ enabled: false });
          running = false;
          recognizer.reset();
          fsm.reset();
          setTimeout(() => {
            adapter.exit();
            disable(); // Complete teardown
          }, 3000);
        }
      }
    });

    hud.update('IDLE', 'NONE');
    running = true;
    setStatus('running', 'listening...');
    logger.info('INIT', 'Extension successfully enabled');

  } catch (err: any) {
    running = false;
    setStatus('off', '—');

    if (err.message === 'PERMISSION_DENIED') {
      hud?.showError('camera blocked');
    } else if (err.message === 'NO_CAMERA') {
      hud?.showError('no camera found');
    } else if (err.message === 'WASM_TIMEOUT') {
      hud?.showError('model load timeout');
    } else {
      hud?.showError('failed to start');
      logger.error('INIT', 'Start failed:', err.message);
    }
  } finally {
    starting = false;
  }
}

function disable() {
  logger.info('CLEANUP', 'Disabling gesture extension...');
  stopCamera();
  // Keep MediaPipe model alive in memory across disable/enable cycles.
  // Only destroy on page unload to avoid 5-10s model reload on re-enable.
  hud?.destroy();
  hud = null;
  running = false;
  starting = false;
  setStatus('off', '—');
  recognizer.reset();
  fsm.reset();
  logger.info('CLEANUP', 'Extension disabled (model kept alive)');
}

// Ensure full cleanup if the window unloads
window.addEventListener('beforeunload', () => {
  disable();
  destroyMediaPipe();
});

// Listen for toggle from popup via background
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'EXTENSION_TOGGLE') {
    enabled = msg.enabled;
    if (enabled) enable();
    else disable();
  }

  if (msg.type === 'GET_EXTENSION_STATUS') {
    sendResponse({
      running,
      starting,
      enabled,
      camera: cameraState,
      gesture: gestureState,
      platform: platformName,
    });
  }
});

// Watch for SPA navigation via our custom history patch (from platforms/index.ts)
window.addEventListener('gesture:urlchange', () => {
  chrome.storage.local.get('enabled').then((res) => {
    if (res.enabled) {
      logger.info('INIT', 'SPA Navigation detected, restarting extension safely...');
      disable();

      if (spaRestartTimeout !== null) {
        window.clearTimeout(spaRestartTimeout);
      }
      if (spaRecoveryTimeout !== null) {
        window.clearTimeout(spaRecoveryTimeout);
      }

      spaRestartTimeout = window.setTimeout(() => {
        chrome.storage.local.get('enabled').then((state) => {
          if (state.enabled) {
            enable();
            spaRecoveryTimeout = window.setTimeout(() => {
              if (enabled && !running && !starting) {
                logger.warn('INIT', 'SPA restart did not complete, retrying enable()');
                enable();
              }
            }, SPA_RECOVERY_RETRY_MS);
          }
        });
      }, SPA_RESTART_DELAY_MS);
    }
  }).catch(() => {});
});

// Read saved state on initial page load
async function init() {
  installSPAWatcher();
  await logger.initialize();
  const result = await chrome.storage.local.get('enabled');
  enabled = result.enabled === true;
  if (enabled) enable();
}

init();
