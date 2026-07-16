import { logger } from '../logger';
import type { PlatformAdapter } from './index';
import { getMostVisibleVideo } from './utils';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly name: string;
  abstract isActive(): boolean;
  abstract next(): void;
  abstract previous(): void;
  abstract togglePause(): void;
  abstract toggleSpeed(): void;
  abstract exit(): void;
  abstract getCurrentVideo(): HTMLVideoElement | null;
  abstract destroy(): void;

  protected withErrorLog<T>(label: string, fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch (err) {
      logger.error('ERROR', `${label} failed:`, String(err));
      return fallback;
    }
  }

  protected getMostVisibleVideo(videos: HTMLVideoElement[]): HTMLVideoElement | null {
    return getMostVisibleVideo(videos);
  }

  protected togglePlaybackRate(video: HTMLVideoElement, platform: string): void {
    const currentRate = video.playbackRate;
    const isTwoX = Math.abs(currentRate - 2.0) < 0.25;

    if (!isTwoX) {
      video.playbackRate = 2.0;
      logger.info('ACTION', `${platform}: Speed 2x`);
    } else {
      video.playbackRate = 1.0;
      logger.info('ACTION', `${platform}: Speed 1x`);
    }
  }
}
