import { logger } from '../logger';
import type { PlatformAdapter } from './index';
import { BasePlatformAdapter } from './base-adapter';
import { getFeedVideos } from './utils';

export class TikTokAdapter extends BasePlatformAdapter implements PlatformAdapter {
  readonly name = 'tiktok' as const;

  isActive(): boolean {
    return location.hostname === 'www.tiktok.com';
  }

  getCurrentVideo(): HTMLVideoElement | null {
    try {
      // Try finding video within browse-video container
      const browseContainer = document.querySelector<HTMLElement>('[data-e2e="browse-video"]');
      if (browseContainer) {
        const video = browseContainer.querySelector<HTMLVideoElement>('video');
        if (video) {
          return video;
        }
      }

      // Fallback: find most visible feed video in viewport
      return this.getMostVisibleVideo(getFeedVideos());
    } catch (err) {
      logger.error('PLATFORM', 'TikTok getCurrentVideo failed:', String(err));
      return null;
    }
  }

  next(): void {
    this.withErrorLog('TikTok next', () => {
      logger.info('ACTION', 'TikTok: Attempting next video');
      const videos = getFeedVideos();
      const activeVideo = this.getMostVisibleVideo(videos);

      if (activeVideo) {
        const nextIndex = videos.indexOf(activeVideo) + 1;
        const nextVideo = videos[nextIndex];
        if (nextVideo) {
          logger.info('ACTION', 'TikTok: Scrolling to next video element');
          nextVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      logger.info('ACTION', 'TikTok: Fallback dispatching ArrowDown key');
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
      }));
    }, undefined);
  }

  previous(): void {
    this.withErrorLog('TikTok previous', () => {
      logger.info('ACTION', 'TikTok: Attempting previous video');
      const videos = getFeedVideos();
      const activeVideo = this.getMostVisibleVideo(videos);

      if (activeVideo) {
        const previousIndex = videos.indexOf(activeVideo) - 1;
        const previousVideo = videos[previousIndex];
        if (previousVideo) {
          logger.info('ACTION', 'TikTok: Scrolling to previous video element');
          previousVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      }

      logger.info('ACTION', 'TikTok: Fallback dispatching ArrowUp key');
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, bubbles: true, cancelable: true
      }));
    }, undefined);
  }

  togglePause(): void {
    this.withErrorLog('TikTok togglePause', () => {
      const video = this.getCurrentVideo();
      if (!video) return;

      if (video.paused) {
        logger.info('ACTION', 'TikTok: Resuming video');
        video.play().catch(err => logger.warn('ACTION', 'TikTok play failed:', err.message));
      } else {
        logger.info('ACTION', 'TikTok: Pausing video');
        video.pause();
      }
    }, undefined);
  }

  toggleSpeed(): void {
    this.withErrorLog('TikTok toggleSpeed', () => {
      const video = this.getCurrentVideo();
      if (!video) return;
      this.togglePlaybackRate(video, 'TikTok');
    }, undefined);
  }

  exit(): void {
    logger.info('ACTION', 'TikTok: Exiting');
    window.location.href = 'https://www.tiktok.com';
  }

  destroy(): void {
    logger.info('CLEANUP', 'TikTok Adapter destroyed');
  }
}
