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
