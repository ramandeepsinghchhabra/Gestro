import { logger } from '../logger';
import { YouTubeAdapter } from './youtube';
import { InstagramAdapter } from './instagram';
import { TikTokAdapter } from './tiktok';

export type PlatformName = 'youtube' | 'instagram' | 'tiktok';

export interface PlatformAdapter {
  readonly name: string;
  isActive(): boolean;
  next(): void;
  previous(): void;
  togglePause(): void;
  toggleSpeed(): void;
  exit(): void;
  getCurrentVideo(): HTMLVideoElement | null;
  destroy(): void;
}

export function detectPlatform(): PlatformName | null {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  if (hostname === 'www.youtube.com' && pathname.startsWith('/shorts')) {
    logger.info('PLATFORM', 'Detected: youtube');
    return 'youtube';
  }

  if (hostname === 'www.instagram.com' && pathname.includes('/reel')) {
    logger.info('PLATFORM', 'Detected: instagram');
    return 'instagram';
  }

  if (hostname.includes('tiktok.com')) {
    logger.info('PLATFORM', 'Detected: tiktok');
    return 'tiktok';
  }

  logger.info('PLATFORM', 'No supported platform detected');
  return null;
}

export function createAdapter(platform: PlatformName): PlatformAdapter {
  switch (platform) {
    case 'youtube': return new YouTubeAdapter();
    case 'instagram': return new InstagramAdapter();
    case 'tiktok': return new TikTokAdapter();
  }
}

let spaWatcherInstalled = false;
export function installSPAWatcher(): void {
  if (spaWatcherInstalled) return;
  spaWatcherInstalled = true;

  const originalPushState = history.pushState.bind(history);
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    originalPushState(...args);
    window.dispatchEvent(new Event('gesture:urlchange'));
  };

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    originalReplaceState(...args);
    window.dispatchEvent(new Event('gesture:urlchange'));
  };

  window.addEventListener('popstate', () => {
    window.dispatchEvent(new Event('gesture:urlchange'));
  });
}

export { YouTubeAdapter } from './youtube';
export { InstagramAdapter } from './instagram';
export { TikTokAdapter } from './tiktok';
