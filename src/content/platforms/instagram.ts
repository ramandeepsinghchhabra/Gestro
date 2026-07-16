import { logger } from '../logger';
import type { PlatformAdapter } from './index';
import { BasePlatformAdapter } from './base-adapter';
import { getFeedVideos } from './utils';

export class InstagramAdapter extends BasePlatformAdapter implements PlatformAdapter {
  readonly name = 'instagram' as const;

  isActive(): boolean {
    if (location.hostname !== 'www.instagram.com') return false;
    const path = location.pathname;
    return path.includes('/reels/') || path.includes('/reel/');
  }

  getCurrentVideo(): HTMLVideoElement | null {
    return this.withErrorLog('Instagram getCurrentVideo', () => {
      return this.getMostVisibleVideo(getFeedVideos());
    }, null);
  }

  next(): void {
    this.withErrorLog('Instagram next', () => {
      logger.info('ACTION', 'Instagram: Attempting next video');
      const videos = getFeedVideos();
      const activeVideo = this.getMostVisibleVideo(videos);

      if (activeVideo) {
        const nextIndex = videos.indexOf(activeVideo) + 1;
        const nextVideo = videos[nextIndex];
        if (nextVideo) {
          logger.info('ACTION', 'Instagram: Scrolling to next video element');
          nextVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      logger.info('ACTION', 'Instagram: Fallback dispatching ArrowDown key');
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
      }));
    }, undefined);
  }

  previous(): void {
    this.withErrorLog('Instagram previous', () => {
      logger.info('ACTION', 'Instagram: Attempting previous video');
      const videos = getFeedVideos();
      const activeVideo = this.getMostVisibleVideo(videos);

      if (activeVideo) {
        const previousIndex = videos.indexOf(activeVideo) - 1;
        const previousVideo = videos[previousIndex];
        if (previousVideo) {
          logger.info('ACTION', 'Instagram: Scrolling to previous video element');
          previousVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      logger.info('ACTION', 'Instagram: Fallback dispatching ArrowUp key');
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, bubbles: true, cancelable: true
      }));
    }, undefined);
  }

  togglePause(): void {
    this.withErrorLog('Instagram togglePause', () => {
      const video = this.getCurrentVideo();
      if (!video) return;

      if (video.paused) {
        logger.info('ACTION', 'Instagram: Resuming video');
        video.play().catch(err => logger.warn('ACTION', 'Instagram play failed:', err.message));
      } else {
        logger.info('ACTION', 'Instagram: Pausing video');
        video.pause();
      }
    }, undefined);
  }

  toggleSpeed(): void {
    this.withErrorLog('Instagram toggleSpeed', () => {
      const video = this.getCurrentVideo();
      if (!video) return;
      this.togglePlaybackRate(video, 'Instagram');
    }, undefined);
  }

  exit(): void {
    logger.info('ACTION', 'Instagram: Exiting Reels');
    window.location.href = 'https://www.instagram.com';
  }

  destroy(): void {
    logger.info('CLEANUP', 'Instagram Adapter destroyed');
  }
}
