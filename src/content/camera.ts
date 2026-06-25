import { logger } from './logger';
import { initMediaPipe, predict } from './mediapipe';
import type { LandmarkPoint } from './recognizer';

export type HandResultCallback = (landmarks: LandmarkPoint[] | null) => void;

let stream: MediaStream | null = null;
let animationId: number | null = null;
let isRunning = false;
let hiddenVideo: HTMLVideoElement | null = null;
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
  } catch (err: any) {
    isRunning = false;
    logger.error('ERROR', 'Failed to get user media:', err.name, err.message);
    if (err.name === 'NotAllowedError') throw new Error('PERMISSION_DENIED');
    if (err.name === 'NotFoundError') throw new Error('NO_CAMERA');
    throw err;
  }

  try {
    await initMediaPipe(onResult);
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
    hiddenVideo.pause();
    hiddenVideo.removeAttribute('src');
    hiddenVideo.srcObject = null;
    hiddenVideo.remove();
    hiddenVideo = null;
    logger.info('CLEANUP', 'Video element removed');
  }

  logger.info('STOP', 'Camera stopped completely');
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

  let frameCount = 0;
  let lastTime = performance.now();

  hiddenVideo.addEventListener('loadeddata', () => {
    logger.info('CAMERA', 'Video data loaded, beginning frame extraction');
    
    async function loop(time: number) {
      if (!isRunning || !stream || !hiddenVideo) {
        logger.info('STOP', 'Inference loop terminating cleanly');
        return;
      }
      
      const deltaTime = time - lastTime;
      
      // Throttle inference to TARGET_FPS to save CPU/Battery
      if (deltaTime >= FRAME_MIN_TIME) {
        lastTime = time - (deltaTime % FRAME_MIN_TIME);
        
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
  });
}
