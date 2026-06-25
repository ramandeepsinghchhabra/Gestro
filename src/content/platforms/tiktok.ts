import { logger } from '../logger';
import type { PlatformAdapter } from './index';
import { getViewportVisibility } from './utils';

export class TikTokAdapter implements PlatformAdapter {
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

      // Fallback: find most visible video in viewport
      const allVideos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
      let bestVideo: HTMLVideoElement | null = null;
      let bestVisibility = 0;

      for (const video of allVideos) {
        const visibility = getViewportVisibility(video);
        if (visibility > bestVisibility) {
          bestVisibility = visibility;
          bestVideo = video;
        }
      }
      return bestVideo;
    } catch (err) {
      logger.error('PLATFORM', 'TikTok getCurrentVideo failed:', String(err));
      return null;
    }
  }

  next(): void {
    try {
      logger.info('ACTION', 'TikTok: Attempting next video');
      const videos = Array.from(document.querySelectorAll('video'));
      let bestIdx = -1;
      let bestVis = 0;

      for (let i = 0; i < videos.length; i++) {
        const vis = getViewportVisibility(videos[i]);
        if (vis > bestVis) {
          bestVis = vis;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0 && bestIdx < videos.length - 1) {
        logger.info('ACTION', 'TikTok: Scrolling to next video element');
        const targetVideo = videos[bestIdx + 1];
        targetVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      logger.info('ACTION', 'TikTok: Fallback dispatching ArrowDown key');
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
      }));
    } catch (err) {
      logger.error('ERROR', 'TikTok next() failed:', String(err));
    }
  }

  previous(): void {
    try {
      logger.info('ACTION', 'TikTok: Attempting previous video');
      const videos = Array.from(document.querySelectorAll('video'));
      let bestIdx = -1;
      let bestVis = 0;

      for (let i = 0; i < videos.length; i++) {
        const vis = getViewportVisibility(videos[i]);
        if (vis > bestVis) {
          bestVis = vis;
          bestIdx = i;
        }
      }

      if (bestIdx > 0) {
        logger.info('ACTION', 'TikTok: Scrolling to previous video element');
        const targetVideo = videos[bestIdx - 1];
        targetVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      logger.info('ACTION', 'TikTok: Fallback dispatching ArrowUp key');
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, bubbles: true, cancelable: true
      }));
    } catch (err) {
      logger.error('ERROR', 'TikTok previous() failed:', String(err));
    }
  }

  togglePause(): void {
    try {
      const video = this.getCurrentVideo();
      if (!video) return;

      if (video.paused) {
        logger.info('ACTION', 'TikTok: Resuming video');
        video.play().catch(err => logger.warn('ACTION', 'TikTok play failed:', err.message));
      } else {
        logger.info('ACTION', 'TikTok: Pausing video');
        video.pause();
      }
    } catch (err) {
      logger.error('ERROR', 'TikTok togglePause failed:', String(err));
    }
  }

  toggleSpeed(): void {
    try {
      const video = this.getCurrentVideo();
      if (!video) return;
      
      if (video.playbackRate === 1.0) {
        video.playbackRate = 2.0;
        logger.info('ACTION', 'TikTok: Speed 2x');
      } else {
        video.playbackRate = 1.0;
        logger.info('ACTION', 'TikTok: Speed 1x');
      }
    } catch (err) {
      logger.error('ERROR', 'TikTok toggleSpeed failed:', String(err));
    }
  }

  exit(): void {
    logger.info('ACTION', 'TikTok: Exiting');
    window.location.href = 'https://www.tiktok.com';
  }

  destroy(): void {
    logger.info('CLEANUP', 'TikTok Adapter destroyed');
  }
}
