import { logger } from '../logger';

/**
 * Calculates what percentage of the element's area is visible within the viewport.
 * Returns a value between 0.0 and 1.0.
 */
export function getViewportVisibility(el: Element): number {
  try {
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const overlapTop = Math.max(0, rect.top);
    const overlapBottom = Math.min(viewportHeight, rect.bottom);
    const overlapLeft = Math.max(0, rect.left);
    const overlapRight = Math.min(viewportWidth, rect.right);

    if (overlapBottom <= overlapTop || overlapRight <= overlapLeft) {
      return 0;
    }

    const overlapArea = (overlapBottom - overlapTop) * (overlapRight - overlapLeft);
    const elementArea = rect.width * rect.height;

    if (elementArea === 0) return 0;
    return overlapArea / elementArea;
  } catch (err) {
    logger.error('ERROR', 'getViewportVisibility failed:', String(err));
    return 0;
  }
}

export function getFeedVideos(): HTMLVideoElement[] {
  return Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
    .filter((video) => {
      if (video.hidden) return false;
      if (video.offsetWidth === 0 || video.offsetHeight === 0) return false;
      const style = window.getComputedStyle(video);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    })
    .sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectA.top - rectB.top || rectA.left - rectB.left;
    });
}

export function getMostVisibleVideo(videos: HTMLVideoElement[]): HTMLVideoElement | null {
  let bestVideo: HTMLVideoElement | null = null;
  let bestVisibility = 0;

  for (const video of videos) {
    const visibility = getViewportVisibility(video);
    if (visibility > bestVisibility) {
      bestVisibility = visibility;
      bestVideo = video;
    }
  }

  return bestVideo;
}
