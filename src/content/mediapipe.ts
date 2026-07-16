import { logger } from './logger';
import type { LandmarkPoint } from './recognizer';

// Define expected interface on window for MediaPipe legacy hands
interface MediaPipeHandsOptions {
  maxNumHands: number;
  modelComplexity: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

interface MediaPipeHands {
  setOptions(options: MediaPipeHandsOptions): void;
  onResults(callback: (results: any) => void): void;
  initialize(): Promise<void>;
  send(config: { image: HTMLVideoElement }): Promise<void>;
  close(): void;
}

let handsInstance: MediaPipeHands | null = null;
let isInitializing = false;

/**
 * Robustly initializes the MediaPipe Hands model from local extension assets.
 */
export async function initMediaPipe(onResult: (landmarks: LandmarkPoint[] | null) => void): Promise<void> {
  if (handsInstance) {
    logger.info('MODEL', 'MediaPipe already initialized, reusing instance.');
    // Just update the callback
    handsInstance.onResults((results: any) => {
      const landmarks = results.multiHandLandmarks?.[0] ?? null;
      onResult(landmarks);
    });
    return;
  }

  if (isInitializing) {
    logger.info('MODEL', 'Initialization already in progress, waiting...');
    // Simple poll until done (could be improved, but usually enough)
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }

    const initializedHands = handsInstance;
    if (initializedHands) {
      initializedHands.onResults((results: any) => {
        const landmarks = results.multiHandLandmarks?.[0] ?? null;
        onResult(landmarks);
      });
      return;
    }
  }

  isInitializing = true;
  logger.info('MODEL', 'Initializing MediaPipe from scratch...');

  try {
    const base = chrome.runtime.getURL('models/hands/');
    
    // Set up global locators so the WASM modules load from extension resources
    const w = window as any;
    const locator = { locateFile: (file: string) => base + file };
    w.createMediapipeSolutionsPackedAssets = locator;
    w.createMediapipeSolutionsWasm = locator;
    w.createMediapipeSolutionsSimdWasm = locator;

    // Load the hands.js script dynamically via dynamic import. 
    // This assumes hands.js is exposed via web_accessible_resources and is ES-module compatible or modifies window.
    const handsUrl = base + 'hands.js';
    
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 20000);

    // Intercept script tag insertion because hands.js tries to inject scripts into the page DOM
    // which causes CSP errors and wrong path resolution (relative to youtube.com instead of extension)
    let origAppendChild: typeof Node.prototype.appendChild | null = null;
    
    try {
      origAppendChild = Node.prototype.appendChild;
      (Node.prototype as any).appendChild = function <T extends Node>(child: T): T {
        if (child instanceof HTMLScriptElement && child.src?.startsWith('chrome-extension://')) {
          const url = child.src;
          logger.info('MODEL', `Intercepting script: ${url.split('/').pop()}`);
          import(/* @vite-ignore */ url)
            .then(() => {
              logger.info('MODEL', `Loaded intercepted script: ${url.split('/').pop()}`);
              child.dispatchEvent(new Event('load'));
            })
            .catch((err) => {
              logger.error('ERROR', `Script load failed: ${url.split('/').pop()}`, err);
              child.dispatchEvent(new Event('error'));
            });
          return child; // Don't actually append it to DOM!
        }
        return origAppendChild!.call(this, child) as T;
      };

      logger.info('MODEL', 'Fetching hands.js module...');
      await import(/* @vite-ignore */ handsUrl);

      const HandsClass = (window as any).Hands;
      if (!HandsClass) {
        throw new Error('Hands constructor not found on window after script load.');
      }

      logger.info('MODEL', 'Hands constructor found, creating instance...');
      const hands = new HandsClass({
        locateFile: (file: string) => {
          logger.info('MODEL', `Locating WASM file: ${file}`);
          return base + file;
        }
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, // 0 for max speed, 1 for accuracy
        minDetectionConfidence: 0.80,
        minTrackingConfidence: 0.80
      });

      hands.onResults((results: any) => {
        const landmarks = results.multiHandLandmarks?.[0] ?? null;
        onResult(landmarks);
      });

      logger.info('MODEL', 'Awaiting hands.initialize()...');
      
      // Race initialization against a timeout manually
      await Promise.race([
        hands.initialize(),
        new Promise((_, reject) => {
          if (controller.signal.aborted) reject(new Error('WASM_TIMEOUT'));
          controller.signal.addEventListener('abort', () => reject(new Error('WASM_TIMEOUT')));
        })
      ]);

      clearTimeout(timeoutId);
      
      handsInstance = hands;
      logger.info('INIT', 'MediaPipe fully initialized and ready!');
    } finally {
      if (origAppendChild) {
        Node.prototype.appendChild = origAppendChild;
      }
    }
  } catch (err: any) {
    logger.error('ERROR', 'MediaPipe initialization failed:', err.message);
    throw err;
  } finally {
    isInitializing = false;
  }
}

/**
 * Predicts hand landmarks for a given video frame.
 */
export async function predict(video: HTMLVideoElement): Promise<void> {
  if (!handsInstance) return;
  await handsInstance.send({ image: video });
}

/**
 * Cleans up the model instance (only do this if completely destroying the extension).
 */
export function destroyMediaPipe(): void {
  if (handsInstance) {
    logger.info('CLEANUP', 'Closing MediaPipe instance');
    handsInstance.close();
    handsInstance = null;
  }
}
