import { logger } from '../logger';
import type { PlatformAdapter } from './index';
import { BasePlatformAdapter } from './base-adapter';

export class YouTubeAdapter extends BasePlatformAdapter implements PlatformAdapter {
  readonly name = 'youtube' as const;

  isActive(): boolean {
    return (
      location.hostname === 'www.youtube.com' &&
      location.pathname.startsWith('/shorts/')
    );
  }

  getCurrentVideo(): HTMLVideoElement | null {
    return this.withErrorLog('YouTube getCurrentVideo', () => {
      const allVideos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
        .filter((video) => video.style.opacity !== '0' && video.style.width !== '1px');

      return this.getMostVisibleVideo(allVideos);
    }, null);
  }

  next(): void {
    this.withErrorLog('YouTube next', () => {
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
    }, undefined);
  }

  previous(): void {
    this.withErrorLog('YouTube previous', () => {
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
    }, undefined);
  }

  togglePause(): void {
    this.withErrorLog('YouTube togglePause', () => {
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
    }, undefined);
  }

  toggleSpeed(): void {
    this.withErrorLog('YouTube toggleSpeed', () => {
      const video = this.getCurrentVideo();
      if (!video) return;
      this.togglePlaybackRate(video, 'YouTube');
    }, undefined);
  }

  exit(): void {
    logger.info('ACTION', 'YouTube: Exiting Shorts');
    window.location.href = 'https://www.youtube.com';
  }

  destroy(): void {
    logger.info('CLEANUP', 'YouTube adapter destroyed');
  }
}
