/**
 * Gesture State Machine — 5-state FSM controlling gesture lifecycle.
 *
 * IDLE       → no gesture detected
 * DETECTING  → gesture candidate appeared
 * CONFIRMING → same gesture held for 5+ consecutive frames
 * TRIGGERED  → action fired, entering cooldown
 * COOLDOWN   → ignoring all input for gesture-specific duration
 */

import { logger } from './logger';
import type { Gesture } from './recognizer';

export type FSMState = 'IDLE' | 'DETECTING' | 'CONFIRMING' | 'TRIGGERED' | 'COOLDOWN';

export interface FSMOutput {
  state: FSMState;
  gesture: Gesture;
  shouldFire: boolean;
}

// ── Timing constants ──
export const CONFIRM_FRAMES = 6;              // 6 consecutive frames required (prevents misfires)
export const RAPID_CONFIRM_FRAMES = 4;        // Shorter confirm window for rapid fire gestures
const PAUSE_HOLD_MS = 700;                    // Open palm hold for 700ms
const PAUSE_COOLDOWN_MS = 1200;               // Cooldown for pause
export const SWIPE_COOLDOWN_MS = 1200;        // Cooldown for next/prev
export const RAPID_SWIPE_COOLDOWN_MS = 800;   // Reduced cooldown for rapid gesture sequences
export const RAPID_FIRE_WINDOW_MS = 2000;     // When repeated gestures happen within this window
const EXIT_HOLD_MS = 1500;                    // Open palm must be held 1.5s to exit
const EXIT_COOLDOWN_MS = 3000;                // Long cooldown after exit
const HAND_ABSENT_TIMEOUT_MS = 3000;

export class GestureStateMachine {
  private state: FSMState = 'IDLE';
  private currentGesture: Gesture = 'NONE';
  private detectCount = 0;
  private confirmStartTime = 0;
  private cooldownStartTime = 0;
  private cooldownDuration = 0;
  private lastHandSeenTime = -1;
  private lastTriggerTime = -1;

  update(gesture: Gesture, timestamp: number): FSMOutput {
    if (gesture !== 'NONE') {
      this.lastHandSeenTime = timestamp;
    } else if (this.lastHandSeenTime >= 0 && timestamp - this.lastHandSeenTime > HAND_ABSENT_TIMEOUT_MS && this.state !== 'COOLDOWN') {
      this.reset();
      return { state: 'IDLE', gesture: 'NONE', shouldFire: false };
    }

    switch (this.state) {
      case 'IDLE':
        return this.handleIdle(gesture);
      case 'DETECTING':
        return this.handleDetecting(gesture, timestamp);
      case 'CONFIRMING':
        return this.handleConfirming(gesture, timestamp);
      case 'TRIGGERED':
        return this.handleTriggered(timestamp);
      case 'COOLDOWN':
        return this.handleCooldown(timestamp);
      default: {
        const _exhaustive: never = this.state;
        return this.assertUnreachable(_exhaustive);
      }
    }
  }

  private assertUnreachable(value: never): never {
    throw new Error(`Unhandled FSM state: ${String(value)}`);
  }

  reset(): void {
    this.state = 'IDLE';
    this.currentGesture = 'NONE';
    this.detectCount = 0;
    this.confirmStartTime = 0;
    this.cooldownStartTime = 0;
    this.cooldownDuration = 0;
    this.lastTriggerTime = -1;
  }

  getState(): FSMState {
    return this.state;
  }

  // ── State handlers ──

  private handleIdle(gesture: Gesture): FSMOutput {
    if (gesture !== 'NONE') {
      this.state = 'DETECTING';
      this.currentGesture = gesture;
      this.detectCount = 1;
      logger.info('GESTURE', `FSM: IDLE → DETECTING: ${gesture}`);
    }
    return { state: this.state, gesture: this.currentGesture, shouldFire: false };
  }

  private handleDetecting(gesture: Gesture, timestamp: number): FSMOutput {
    if (gesture === 'NONE' || gesture !== this.currentGesture) {
      this.state = 'IDLE';
      this.currentGesture = 'NONE';
      this.detectCount = 0;
      return { state: 'IDLE', gesture: 'NONE', shouldFire: false };
    }

    this.detectCount++;

    const neededFrames = this.getConfirmFrames(this.currentGesture, timestamp);
    if (this.detectCount >= neededFrames) {
      this.state = 'CONFIRMING';
      this.confirmStartTime = timestamp;
      logger.info('GESTURE', `FSM: DETECTING → CONFIRMING: ${gesture} (${this.detectCount} frames, need ${neededFrames})`);

      // NEXT/PREV/SPEED fire immediately after confirmation
      if (gesture === 'NEXT' || gesture === 'PREV' || gesture === 'SPEED') {
        return this.fireAction(gesture, timestamp);
      }
    }

    return { state: this.state, gesture: this.currentGesture, shouldFire: false };
  }

  private handleConfirming(gesture: Gesture, timestamp: number): FSMOutput {
    if (gesture !== this.currentGesture) {
      this.state = 'IDLE';
      this.currentGesture = 'NONE';
      this.detectCount = 0;
      logger.info('GESTURE', 'FSM: CONFIRMING → IDLE: gesture changed');
      return { state: 'IDLE', gesture: 'NONE', shouldFire: false };
    }

    // PAUSE requires hold duration
    if (this.currentGesture === 'PAUSE') {
      const held = timestamp - this.confirmStartTime;
      if (held >= PAUSE_HOLD_MS) {
        return this.fireAction(gesture, timestamp);
      }
    }

    // EXIT requires longer hold to prevent accidental triggers
    if (this.currentGesture === 'EXIT') {
      const held = timestamp - this.confirmStartTime;
      if (held >= EXIT_HOLD_MS) {
        return this.fireAction(gesture, timestamp);
      }
    }

    return { state: 'CONFIRMING', gesture: this.currentGesture, shouldFire: false };
  }

  private handleTriggered(timestamp: number): FSMOutput {
    this.state = 'COOLDOWN';
    this.cooldownStartTime = timestamp;
    logger.info('GESTURE', `FSM: TRIGGERED → COOLDOWN (${this.cooldownDuration}ms)`);
    return { state: 'COOLDOWN', gesture: this.currentGesture, shouldFire: false };
  }

  private handleCooldown(timestamp: number): FSMOutput {
    const elapsed = timestamp - this.cooldownStartTime;
    if (elapsed >= this.cooldownDuration) {
      this.state = 'IDLE';
      this.currentGesture = 'NONE';
      this.detectCount = 0;
      logger.info('GESTURE', 'FSM: COOLDOWN → IDLE');
    }
    return { state: this.state, gesture: this.currentGesture, shouldFire: false };
  }

  // ── Internal ──

  private fireAction(gesture: Gesture, timestamp: number): FSMOutput {
    logger.info('ACTION', `FSM: ★ TRIGGERED: ${gesture}`);

    // Set gesture-specific cooldown, shortening it for rapid-fire swipe sequences.
    this.cooldownDuration = gesture === 'EXIT'
      ? EXIT_COOLDOWN_MS
      : gesture === 'PAUSE'
        ? PAUSE_COOLDOWN_MS
        : this.isRapidSwipe(gesture, timestamp)
          ? RAPID_SWIPE_COOLDOWN_MS
          : SWIPE_COOLDOWN_MS;

    this.lastTriggerTime = timestamp;
    this.state = 'COOLDOWN';
    this.cooldownStartTime = timestamp;

    return { state: 'TRIGGERED', gesture, shouldFire: true };
  }

  private getConfirmFrames(gesture: Gesture, timestamp: number): number {
    if ((gesture === 'NEXT' || gesture === 'PREV' || gesture === 'SPEED')
      && this.lastTriggerTime >= 0
      && timestamp - this.lastTriggerTime <= RAPID_FIRE_WINDOW_MS) {
      return RAPID_CONFIRM_FRAMES;
    }

    return CONFIRM_FRAMES;
  }

  private isRapidSwipe(gesture: Gesture, timestamp: number): boolean {
    return (gesture === 'NEXT' || gesture === 'PREV' || gesture === 'SPEED')
      && this.lastTriggerTime >= 0
      && timestamp - this.lastTriggerTime <= RAPID_FIRE_WINDOW_MS;
  }
}
