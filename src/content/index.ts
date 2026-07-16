import { logger } from './logger';
import { startCamera, stopCamera } from './camera';
import { destroyMediaPipe } from './mediapipe';
import { GestureRecognizer } from './recognizer';
import { GestureStateMachine } from './state-machine';
import { HUD } from './hud';
import { detectPlatform, createAdapter } from './platforms/index';

let enabled = false;
let running = false;
let starting = false;
let hud: HUD | null = null;
const recognizer = new GestureRecognizer();
const fsm = new GestureStateMachine();

async function enable() {
  if (running || starting) {
    logger.info('INIT', 'Extension is already running or starting');
    return;
  }
  
  starting = true;
  logger.info('INIT', 'Enabling gesture extension...');

  const platform = detectPlatform();
  if (!platform) {
    logger.error('INIT', 'Not a supported platform');
    starting = false;
    return;
  }

  const adapter = createAdapter(platform);
  hud = new HUD();
  hud.update('LOADING', 'NONE');

  try {
    await startCamera((landmarks) => {
      const gesture = recognizer.recognize(landmarks ?? []);
      const output = fsm.update(gesture.gesture, performance.now());

      hud?.update(output.state, output.gesture);

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
          const isfast = video && video.playbackRate > 1.5;
          hud?.update('TRIGGERED', 'SPEED', undefined, undefined, isfast ? '⚡ 2X SPEED' : '▶ NORMAL SPEED');
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
    logger.info('INIT', 'Extension successfully enabled');

  } catch (err: any) {
    running = false;
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
  recognizer.reset();
  fsm.reset();
  logger.info('CLEANUP', 'Extension disabled (model kept alive)');
}

// Ensure full cleanup if the window unloads
window.addEventListener('beforeunload', disable);

// Listen for toggle from popup via background
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'EXTENSION_TOGGLE') {
    enabled = msg.enabled;
    if (enabled) enable();
    else disable();
  }

  if (msg.type === 'GET_EXTENSION_STATUS') {
    sendResponse({ running, starting, enabled });
  }
});

// Watch for SPA navigation via our custom history patch (from platforms/index.ts)
window.addEventListener('gesture:urlchange', () => {
  if (enabled) {
    logger.info('INIT', 'SPA Navigation detected, restarting extension safely...');
    disable();
    // Small delay to allow framework hydration to finish removing old DOM
    setTimeout(() => {
      // Re-check enabled state in case user turned it off during navigation
      chrome.storage.local.get('enabled').then((res) => {
        if (res.enabled) enable();
      });
    }, 800);
  }
});

// Read saved state on initial page load
async function init() {
  const result = await chrome.storage.local.get('enabled');
  enabled = result.enabled === true;
  if (enabled) enable();
}

init();
