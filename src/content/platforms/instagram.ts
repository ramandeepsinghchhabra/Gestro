import { logger } from '../logger';
import type { PlatformAdapter } from './index';
import { getViewportVisibility } from './utils';

export class InstagramAdapter implements PlatformAdapter {
  readonly name = 'instagram' as const;

  isActive(): boolean {
    if (location.hostname !== 'www.instagram.com') return false;
    const path = location.pathname;
    return path.includes('/reels/') || path.includes('/reel/');
  }

  getCurrentVideo(): HTMLVideoElement | null {
    try {
      const allVideos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
      if (allVideos.length === 0) return null;

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
      logger.error('PLATFORM', 'Instagram getCurrentVideo failed:', String(err));
      return null;
    }
  }

  next(): void {
    try {
      logger.info('ACTION', 'Instagram: Attempting next video');
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
        logger.info('ACTION', 'Instagram: Scrolling to next video element');
        const targetVideo = videos[bestIdx + 1];
        targetVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      logger.info('ACTION', 'Instagram: Fallback dispatching ArrowDown key');
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true, cancelable: true
      }));
    } catch (err) {
      logger.error('ERROR', 'Instagram next() failed:', String(err));
    }
  }

  previous(): void {
    try {
      logger.info('ACTION', 'Instagram: Attempting previous video');
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
        logger.info('ACTION', 'Instagram: Scrolling to previous video element');
        const targetVideo = videos[bestIdx - 1];
        targetVideo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      logger.info('ACTION', 'Instagram: Fallback dispatching ArrowUp key');
      document.body.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, bubbles: true, cancelable: true
      }));
    } catch (err) {
      logger.error('ERROR', 'Instagram previous() failed:', String(err));
    }
  }

  togglePause(): void {
    try {
      const video = this.getCurrentVideo();
      if (!video) return;

      if (video.paused) {
        logger.info('ACTION', 'Instagram: Resuming video');
        video.play().catch(err => logger.warn('ACTION', 'Instagram play failed:', err.message));
      } else {
        logger.info('ACTION', 'Instagram: Pausing video');
        video.pause();
      }
    } catch (err) {
      logger.error('ERROR', 'Instagram togglePause failed:', String(err));
    }
  }

  toggleSpeed(): void {
    try {
      const video = this.getCurrentVideo();
      if (!video) return;
      
      if (video.playbackRate === 1.0) {
        video.playbackRate = 2.0;
        logger.info('ACTION', 'Instagram: Speed 2x');
      } else {
        video.playbackRate = 1.0;
        logger.info('ACTION', 'Instagram: Speed 1x');
      }
    } catch (err) {
      logger.error('ERROR', 'Instagram toggleSpeed failed:', String(err));
    }
  }

  exit(): void {
    logger.info('ACTION', 'Instagram: Exiting Reels');
    window.location.href = 'https://www.instagram.com';
  }

  destroy(): void {
    logger.info('CLEANUP', 'Instagram Adapter destroyed');
  }
}
