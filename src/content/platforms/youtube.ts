import { logger } from '../logger';
import type { PlatformAdapter } from './index';

export class YouTubeAdapter implements PlatformAdapter {
  readonly name = 'youtube' as const;

  isActive(): boolean {
    return (
      location.hostname === 'www.youtube.com' &&
      location.pathname.startsWith('/shorts/')
    );
  }

  getCurrentVideo(): HTMLVideoElement | null {
    try {
      const allVideos = document.querySelectorAll<HTMLVideoElement>('video');
      
      for (const video of allVideos) {
        if (video.style.opacity === '0' || video.style.width === '1px') continue;

        const rect = video.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        
        if (center > 0 && center < window.innerHeight && rect.height > 0) {
          return video;
        }
      }

      logger.warn('PLATFORM', 'No active YouTube video found in viewport');
      return null;
    } catch (err) {
      logger.error('PLATFORM', 'Failed to get YouTube video:', String(err));
      return null;
    }
  }

  next(): void {
    try {
      logger.info('ACTION', 'YouTube: Attempting next video');
      const downBtn = document.querySelector<HTMLElement>('#navigation-button-down button, #navigation-button-down yt-button-shape, #navigation-button-down yt-icon-button, [aria-label="Next video"]');
      if (downBtn) {
        logger.info('ACTION', 'YouTube: Clicking native next button');
        downBtn.click();
        return;
      }

      logger.info('ACTION', 'YouTube: Fallback sending ArrowDown');
      if (document.activeElement && document.activeElement.tagName !== 'BODY') {
        (document.activeElement as HTMLElement).blur();
      }
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', keyCode: 40, code: 'ArrowDown', bubbles: true, cancelable: true
      }));
    } catch (err) {
      logger.error('ERROR', 'YouTube next() failed:', String(err));
    }
  }

  previous(): void {
    try {
      logger.info('ACTION', 'YouTube: Attempting previous video');
      const upBtn = document.querySelector<HTMLElement>('#navigation-button-up button, #navigation-button-up yt-button-shape, #navigation-button-up yt-icon-button, [aria-label="Previous video"]');
      if (upBtn) {
        logger.info('ACTION', 'YouTube: Clicking native prev button');
        upBtn.click();
        return;
      }

      logger.info('ACTION', 'YouTube: Fallback sending ArrowUp');
      if (document.activeElement && document.activeElement.tagName !== 'BODY') {
        (document.activeElement as HTMLElement).blur();
      }
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowUp', keyCode: 38, code: 'ArrowUp', bubbles: true, cancelable: true
      }));
    } catch (err) {
      logger.error('ERROR', 'YouTube previous() failed:', String(err));
    }
  }

  togglePause(): void {
    try {
      const video = this.getCurrentVideo();
      if (!video) {
        logger.warn('ACTION', 'YouTube Cannot toggle pause: no video found');
        return;
      }

      if (video.paused) {
        logger.info('ACTION', 'YouTube: Resuming video');
        video.play().catch((err: DOMException) => {
          logger.warn('ACTION', 'YouTube Failed to play video:', err.message);
        });
      } else {
        logger.info('ACTION', 'YouTube: Pausing video');
        video.pause();
      }
    } catch (err) {
      logger.error('ERROR', 'YouTube togglePause() failed:', String(err));
    }
  }

  toggleSpeed(): void {
    try {
      const video = this.getCurrentVideo();
      if (!video) return;
      
      if (video.playbackRate === 1.0) {
        video.playbackRate = 2.0;
        logger.info('ACTION', 'YouTube: Speed 2x');
      } else {
        video.playbackRate = 1.0;
        logger.info('ACTION', 'YouTube: Speed 1x');
      }
    } catch (err) {
      logger.error('ERROR', 'YouTube toggleSpeed() failed:', String(err));
    }
  }

  exit(): void {
    logger.info('ACTION', 'YouTube: Exiting Shorts');
    window.location.href = 'https://www.youtube.com';
  }

  destroy(): void {
    logger.info('CLEANUP', 'YouTube adapter destroyed');
  }
}
