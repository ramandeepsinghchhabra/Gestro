/**
 * Gesture Recognizer — classifies hand landmarks into 5 gestures.
 *
 * ☝️  1 finger  (index up, others curled)         → NEXT
 * ✌️  2 fingers (index + middle up)                → PREV
 * 🤟 3 fingers (index + middle + ring up)          → SPEED (2x toggle)
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
}

interface LandmarkPoint {
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
const INDEX_PIP = 6;
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
const EXTENSION_MARGIN = 0.05;       // Tip must be > this above MCP to count as extended
const INDEX_POINT_MARGIN = 0.10;     // Index pointing margin (stricter for 1-finger)
const CURL_MARGIN = 0.04;            // Tip must be > this below PIP to count as curled
const HIGHEST_POINT_TOLERANCE = 0.03;

export class GestureRecognizer {

  recognize(landmarks: LandmarkPoint[]): RecognitionResult {
    if (landmarks.length < 21) {
      return { gesture: 'NONE', confidence: 0 };
    }

    // Check from MOST specific (fewest fingers) to LEAST specific (all fingers)
    // This prevents 5-finger from matching when you only show 3, etc.

    if (this.isOneFingerUp(landmarks)) {
      return { gesture: 'NEXT', confidence: 0.85 };
    }

    if (this.isTwoFingersUp(landmarks)) {
      return { gesture: 'PREV', confidence: 0.85 };
    }

    if (this.isThreeFingersUp(landmarks)) {
      return { gesture: 'SPEED', confidence: 0.85 };
    }

    if (this.isFourFingersUp(landmarks)) {
      return { gesture: 'PAUSE', confidence: 0.85 };
    }

    if (this.isFiveFingersUp(landmarks)) {
      return { gesture: 'EXIT', confidence: 0.90 };
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

    // Thumb must not be extended for a true one-finger gesture
    if (this.isThumbExtended(lm)) return false;

    // Index tip should be near the highest point, ignoring thumb landmarks
    let minY = Infinity;
    for (let i = THUMB_TIP + 1; i < lm.length; i++) {
      const point = lm[i];
      if (point.y < minY) minY = point.y;
    }
    if (indexTip.y - minY > HIGHEST_POINT_TOLERANCE) return false;

    return true;
  }

  // ── 2 Fingers: Index + middle up, ring + pinky curled ──
  private isTwoFingersUp(lm: LandmarkPoint[]): boolean {
    if (!this.isExtended(lm, INDEX_TIP, INDEX_MCP)) return false;
    if (!this.isExtended(lm, MIDDLE_TIP, MIDDLE_MCP)) return false;

    if (this.isThumbExtended(lm)) return false;
    if (!this.isCurled(lm, RING_TIP, RING_PIP)) return false;
    if (!this.isCurled(lm, PINKY_TIP, PINKY_PIP)) return false;

    return true;
  }

  // ── 3 Fingers: Index + middle + ring up, pinky curled ──
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

    // Thumb must NOT be extended (this differentiates 4 from 5)
    if (this.isThumbExtended(lm)) return false;

    return true;
  }

  // ── 5 Fingers: Full open palm, all fingers + thumb extended ──
  private isFiveFingersUp(lm: LandmarkPoint[]): boolean {
    if (!this.isThumbExtended(lm)) return false;
    if (!this.isExtended(lm, INDEX_TIP, INDEX_MCP)) return false;
    if (!this.isExtended(lm, MIDDLE_TIP, MIDDLE_MCP)) return false;
    if (!this.isExtended(lm, RING_TIP, RING_MCP)) return false;
    if (!this.isExtended(lm, PINKY_TIP, PINKY_MCP)) return false;

    return true;
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
    return wristToTip > wristToMcp + EXTENSION_MARGIN;
  }
}
