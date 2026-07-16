import { logger } from './logger';
import { initMediaPipe, predict } from './mediapipe';
import type { LandmarkPoint } from './recognizer';

export interface HandResult {
  landmarks: LandmarkPoint[] | null;
  brightness: number | null;
}

export type HandResultCallback = (result: HandResult) => void;

let stream: MediaStream | null = null;
let animationId: number | null = null;
let isRunning = false;
let hiddenVideo: HTMLVideoElement | null = null;
let brightnessCanvas: HTMLCanvasElement | null = null;
let latestBrightness: number | null = null;
let loadedDataListener: (() => void) | null = null;
let currentOnResult: HandResultCallback | null = null;

// Target FPS for gesture inference (30fps is plenty for gestures, saves CPU)
const TARGET_FPS = 30;
const FRAME_MIN_TIME = 1000 / TARGET_FPS;

export async function startCamera(onResult: HandResultCallback): Promise<void> {
  logger.info('START', 'Requesting camera start...');
  
  if (isRunning) {
    logger.info('START', 'Camera is already running');
    return;
  }
  
  isRunning = true;
  currentOnResult = onResult;

  try {
    logger.info('CAMERA', 'Requesting user media...');
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 30, max: 30 },
        facingMode: 'user'
      }
    });
    
    if (!isRunning) {
      logger.info('CLEANUP', 'Camera stopped during initialization. Aborting.');
      newStream.getTracks().forEach(t => t.stop());
      return;
    }
    
    stream = newStream;
    logger.info('CAMERA', 'Stream acquired:', stream.id);
    brightnessCanvas = document.createElement('canvas');
    brightnessCanvas.width = 16;
    brightnessCanvas.height = 16;
  } catch (err: any) {
    isRunning = false;
    logger.error('ERROR', 'Failed to get user media:', err.name, err.message);
    if (err.name === 'NotAllowedError') throw new Error('PERMISSION_DENIED');
    if (err.name === 'NotFoundError') throw new Error('NO_CAMERA');
    throw err;
  }

  try {
    const internalOnResult = (landmarks: LandmarkPoint[] | null) => {
      currentOnResult?.({ landmarks, brightness: latestBrightness });
    };

    await initMediaPipe(internalOnResult);
    if (!isRunning) {
      logger.info('CLEANUP', 'Camera stopped during model load. Aborting loop start.');
      return;
    }
    startLoop();
  } catch (err) {
    logger.error('ERROR', 'Failed to start pipeline:', String(err));
    stopCamera();
    throw err;
  }
}

export function stopCamera(): void {
  logger.info('STOP', 'Stopping camera and pipeline...');
  isRunning = false;
  currentOnResult = null;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
    logger.info('CLEANUP', 'Animation frame cancelled');
  }

  if (stream) {
    stream.getTracks().forEach(t => {
      t.stop();
      logger.info('CLEANUP', 'Stopped track:', t.label);
    });
    stream = null;
  }

  if (hiddenVideo) {
    if (loadedDataListener) {
      hiddenVideo.removeEventListener('loadeddata', loadedDataListener);
      loadedDataListener = null;
    }
    hiddenVideo.pause();
    hiddenVideo.removeAttribute('src');
    hiddenVideo.srcObject = null;
    hiddenVideo.remove();
    hiddenVideo = null;
    logger.info('CLEANUP', 'Video element removed');
  }

  brightnessCanvas = null;
  latestBrightness = null;

  logger.info('STOP', 'Camera stopped completely');
}

function getFrameBrightness(video: HTMLVideoElement, canvas: HTMLCanvasElement): number | null {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;
    let pixels = 0;

    for (let i = 0; i < imageData.length; i += 4) {
      const r = imageData[i] as number;
      const g = imageData[i + 1] as number;
      const b = imageData[i + 2] as number;
      total += 0.299 * r + 0.587 * g + 0.114 * b;
      pixels += 1;
    }

    return pixels === 0 ? null : total / pixels / 255;
  } catch {
    return null;
  }
}

function startLoop(): void {
  logger.info('START', 'Starting inference loop...');
  
  hiddenVideo = document.createElement('video');
  hiddenVideo.srcObject = stream!;
  hiddenVideo.autoplay = true;
  hiddenVideo.muted = true;
  hiddenVideo.playsInline = true;
  // Make completely invisible and detached from visual layout
  hiddenVideo.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:-9999px;';
  document.body.appendChild(hiddenVideo);
  
  logger.info('CAMERA', 'Video element created and attached');

  const onLoadedData = () => {
    logger.info('CAMERA', 'Video data loaded, beginning frame extraction');
    
    let frameCount = 0;
    let lastTime = performance.now();

    async function loop(time: number) {
      if (!isRunning || !stream || !hiddenVideo) {
        logger.info('STOP', 'Inference loop terminating cleanly');
        return;
      }
      
      const deltaTime = time - lastTime;
      
      // Throttle inference to TARGET_FPS to save CPU/Battery
      if (deltaTime >= FRAME_MIN_TIME) {
        lastTime = time - (deltaTime % FRAME_MIN_TIME);
        
        if (brightnessCanvas && frameCount % 3 === 0) {
          latestBrightness = getFrameBrightness(hiddenVideo, brightnessCanvas);
        }

        try {
          // Direct video passing! No more canvas copy overhead!
          await predict(hiddenVideo);
          frameCount++;
          if (frameCount % 300 === 0) { // Log every ~10s
            logger.info('GESTURE', `Processed ${frameCount} frames`);
          }
        } catch (err) {
          logger.error('ERROR', 'Frame processing failed:', String(err));
        }
      }

      if (isRunning) {
        animationId = requestAnimationFrame(loop);
      } else {
        logger.info('STOP', 'Inference loop terminating after frame');
      }
    }
    
    // Start the loop
    animationId = requestAnimationFrame(loop);
  };

  loadedDataListener = onLoadedData;
  hiddenVideo.addEventListener('loadeddata', onLoadedData);
}
