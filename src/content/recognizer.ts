/**
 * Gesture Recognizer — classifies hand landmarks into 5 gestures.
 *
 * ☝️  1 finger  (index up, others curled)         → NEXT
 * ✌️  2 fingers (index + middle up, thumb down)   → PREV
 * 🤟 3 fingers (index + middle + ring up, thumb down) → SPEED (2x toggle)
 * 4️⃣  4 fingers (all except thumb)                 → PAUSE / RESUME
 * 🖐  5 fingers (full open palm)                   → EXIT
 *
 * Uses MediaPipe's 21-landmark hand model with normalized coordinates (0-1).
 * Y axis: 0 = top of frame, 1 = bottom of frame.
 */

export type Gesture = 'PAUSE' | 'NEXT' | 'PREV' | 'SPEED' | 'EXIT' | 'NONE';

export interface RecognitionResult {
  gesture: Gesture;
  confidence: number;
  reason?: 'LOW_LIGHT';
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// ── MediaPipe Hand Landmark Indices ──
const WRIST = 0;
const THUMB_TIP = 4;
const THUMB_MCP = 2;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

// ── Thresholds ──
const EXTENSION_MARGIN = 0.05;           // Tip must be > this above MCP to count as extended
const THUMB_SECONDARY_MARGIN = 0.08;     // Thumb must be clearly away from the base joint
const THUMB_ALIGNMENT_THRESHOLD = 0.72;  // Thumb vector should roughly align with the wrist direction
const THUMB_LENGTH_RATIO = 1.10;         // Thumb tip must be a good bit further from wrist than MCP
const THUMB_MIN_EXTENSION_RATIO = 0.40;  // Thumb length relative to wrist-to-MCP for smaller hands
const INDEX_POINT_MARGIN = 0.10;         // Index pointing margin (stricter for 1-finger)
const CURL_MARGIN = 0.04;                // Tip must be > this below PIP to count as curled
const HIGHEST_POINT_TOLERANCE = 0.03;
const LOW_LIGHT_THRESHOLD = 0.18;        // Frame brightness below this is considered dim.

export class GestureRecognizer {

  recognize(landmarks: LandmarkPoint[], brightness: number | null): RecognitionResult {
    if (landmarks.length < 21) {
      if (brightness !== null && brightness < LOW_LIGHT_THRESHOLD) {
        return { gesture: 'NONE', confidence: 0, reason: 'LOW_LIGHT' };
      }
      return { gesture: 'NONE', confidence: 0 };
    }

    // Check from MOST specific (fewest fingers) to LEAST specific (all fingers)
    // This prevents 5-finger from matching when you only show 3, etc.

    if (this.isFiveFingersUp(landmarks)) {
      return { gesture: 'EXIT', confidence: 0.90 };
    }

    if (this.isFourFingersUp(landmarks)) {
      return { gesture: 'PAUSE', confidence: 0.85 };
    }

    if (this.isThreeFingersUp(landmarks)) {
      return { gesture: 'SPEED', confidence: 0.85 };
    }

    if (this.isTwoFingersUp(landmarks)) {
      return { gesture: 'PREV', confidence: 0.85 };
    }

    if (this.isOneFingerUp(landmarks)) {
      return { gesture: 'NEXT', confidence: 0.85 };
    }

    if (brightness !== null && brightness < LOW_LIGHT_THRESHOLD) {
      return { gesture: 'NONE', confidence: 0, reason: 'LOW_LIGHT' };
    }

    return { gesture: 'NONE', confidence: 0 };
  }

  reset(): void {
    // No state to reset in the simplified recognizer
  }

  // ── 1 Finger: Index up, middle + ring + pinky curled ──
  private isOneFingerUp(lm: LandmarkPoint[]): boolean {
    const indexTip = lm[INDEX_TIP];
    const indexMcp = lm[INDEX_MCP];
    if (!indexTip || !indexMcp) return false;

    // Index must be clearly pointing up
    if (indexMcp.y - indexTip.y < INDEX_POINT_MARGIN) return false;

    // Middle, ring, pinky must be curled
    if (!this.isCurled(lm, MIDDLE_TIP, MIDDLE_PIP)) return false;
    if (!this.isCurled(lm, RING_TIP, RING_PIP)) return false;
    if (!this.isCurled(lm, PINKY_TIP, PINKY_PIP)) return false;
    if (this.isThumbExtended(lm)) return false;

    // Index tip should be near the highest point, ignoring thumb landmarks
    let minY = Infinity;
    for (let i = THUMB_TIP + 1; i < lm.length; i++) {
      const point = lm[i];
      if (!point) continue;
      if (point.y < minY) minY = point.y;
    }
    if (indexTip.y - minY > HIGHEST_POINT_TOLERANCE) return false;

    return true;
  }

  // ── 2 Fingers: Index + middle up, ring + pinky curled, thumb must remain down ──
  // Thumb extension on two-finger gestures is intentionally rejected so PREV stays
  // distinct from a partial open palm and does not overlap with 4/5 finger shapes.
  private isTwoFingersUp(lm: LandmarkPoint[]): boolean {
    if (!this.isExtended(lm, INDEX_TIP, INDEX_MCP)) return false;
    if (!this.isExtended(lm, MIDDLE_TIP, MIDDLE_MCP)) return false;
    if (!this.isCurled(lm, RING_TIP, RING_PIP)) return false;
    if (!this.isCurled(lm, PINKY_TIP, PINKY_PIP)) return false;
    if (this.isThumbExtended(lm)) return false;

    return true;
  }

  // ── 3 Fingers: Index + middle + ring up, pinky curled, thumb must remain down ──
  // Thumb extension is rejected here as well so SPEED remains a clearly defined
  // mid-palm gesture rather than a partial four-finger/open-palm shape.
  private isThreeFingersUp(lm: LandmarkPoint[]): boolean {
    if (!this.isExtended(lm, INDEX_TIP, INDEX_MCP)) return false;
    if (!this.isExtended(lm, MIDDLE_TIP, MIDDLE_MCP)) return false;
    if (!this.isExtended(lm, RING_TIP, RING_MCP)) return false;
    if (this.isThumbExtended(lm)) return false;

    if (!this.isCurled(lm, PINKY_TIP, PINKY_PIP)) return false;

    return true;
  }

  // ── 4 Fingers: Index + middle + ring + pinky up, thumb NOT extended ──
  private isFourFingersUp(lm: LandmarkPoint[]): boolean {
    if (!this.isExtended(lm, INDEX_TIP, INDEX_MCP)) return false;
    if (!this.isExtended(lm, MIDDLE_TIP, MIDDLE_MCP)) return false;
    if (!this.isExtended(lm, RING_TIP, RING_MCP)) return false;
    if (!this.isExtended(lm, PINKY_TIP, PINKY_MCP)) return false;
    if (this.isThumbExtended(lm)) return false;
    if (this.isOpenPalmWithThumb(lm)) return false;

    return true;
  }

  // ── 5 Fingers: Full open palm, all fingers + thumb extended ──
  private isFiveFingersUp(lm: LandmarkPoint[]): boolean {
    if (!this.isExtended(lm, INDEX_TIP, INDEX_MCP)) return false;
    if (!this.isExtended(lm, MIDDLE_TIP, MIDDLE_MCP)) return false;
    if (!this.isExtended(lm, RING_TIP, RING_MCP)) return false;
    if (!this.isExtended(lm, PINKY_TIP, PINKY_MCP)) return false;

    return this.isThumbExtended(lm) || this.isOpenPalmWithThumb(lm);
  }

  // ── Helpers ──

  private isExtended(lm: LandmarkPoint[], tipIdx: number, mcpIdx: number): boolean {
    const tip = lm[tipIdx];
    const mcp = lm[mcpIdx];
    if (!tip || !mcp) return false;
    return mcp.y - tip.y > EXTENSION_MARGIN;
  }

  private isCurled(lm: LandmarkPoint[], tipIdx: number, pipIdx: number): boolean {
    const tip = lm[tipIdx];
    const pip = lm[pipIdx];
    if (!tip || !pip) return false;
    return tip.y - pip.y > CURL_MARGIN;
  }

  private isThumbExtended(lm: LandmarkPoint[]): boolean {
    const tip = lm[THUMB_TIP];
    const mcp = lm[THUMB_MCP];
    const wrist = lm[WRIST];
    if (!tip || !mcp || !wrist) return false;

    const wristToTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const wristToMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);

    // Require the thumb tip to be sufficiently beyond the base of the thumb,
    // and also to be oriented away from the wrist in a way consistent with
    // an actually extended thumb rather than a folded palm.
    const thumbVector = { x: tip.x - mcp.x, y: tip.y - mcp.y };
    const baseVector = { x: mcp.x - wrist.x, y: mcp.y - wrist.y };
    const dotProduct = thumbVector.x * baseVector.x + thumbVector.y * baseVector.y;
    const baseLength = Math.hypot(baseVector.x, baseVector.y);
    const thumbLength = Math.hypot(thumbVector.x, thumbVector.y);
    const normalizedDot = baseLength > 0 && thumbLength > 0 ? dotProduct / (baseLength * thumbLength) : 0;
    const isAligned = normalizedDot > THUMB_ALIGNMENT_THRESHOLD;
    const minThumbLength = Math.max(THUMB_SECONDARY_MARGIN, wristToMcp * THUMB_MIN_EXTENSION_RATIO);
    const hasSecondaryExtension = thumbLength > minThumbLength && wristToTip > wristToMcp * THUMB_LENGTH_RATIO;

    return wristToTip > wristToMcp + EXTENSION_MARGIN && isAligned && hasSecondaryExtension;
  }

  private isOpenPalmWithThumb(lm: LandmarkPoint[]): boolean {
    const tipIndices = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
    const fingerTips = tipIndices
      .map((idx) => lm[idx])
      .filter((point): point is LandmarkPoint => Boolean(point));

    if (fingerTips.length !== 5) return false;

    const yValues = fingerTips.map((tip) => tip.y);
    const xValues = fingerTips.map((tip) => tip.x);
    const yRange = Math.max(...yValues) - Math.min(...yValues);
    const xRange = Math.max(...xValues) - Math.min(...xValues);

    const thumbTip = lm[THUMB_TIP];
    const thumbMcp = lm[THUMB_MCP];
    const wrist = lm[WRIST];
    if (!thumbTip || !thumbMcp || !wrist) return false;

    const thumbDistance = Math.hypot(thumbTip.x - thumbMcp.x, thumbTip.y - thumbMcp.y);
    const wristToMcp = Math.hypot(thumbMcp.x - wrist.x, thumbMcp.y - wrist.y);
    const thumbOpenDistance = Math.max(THUMB_SECONDARY_MARGIN * 0.75, wristToMcp * THUMB_MIN_EXTENSION_RATIO);
    const palmSpread = xRange > 0.08 && yRange < 0.30;
    const thumbOutside = thumbTip.x < Math.min(...xValues.slice(1)) - 0.02 || thumbTip.x > Math.max(...xValues.slice(1)) + 0.02;

    return palmSpread && thumbDistance > thumbOpenDistance && thumbOutside;
  }
}
