/**
 * HUD Overlay — Minimal, non-intrusive floating indicator.
 *
 * Idle:       8×8 dot, opacity 0.4, grey
 * Detecting:  10×10 pulsing dot, blue
 * Warning:    Pill, amber text
 * Triggered:  Pill, green text, auto-shrinks after 800ms
 * Error:      Dot, red
 */

import type { FSMState } from './state-machine';
import type { Gesture } from './recognizer';

export class HUD {
  private container: HTMLDivElement;
  private dotEl: HTMLDivElement;
  private textEl: HTMLSpanElement;
  private styleEl: HTMLStyleElement;
  private autoHideTimeout: number | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'gesture-v2-hud';

    this.dotEl = document.createElement('div');
    this.dotEl.className = 'ghud-dot';

    this.textEl = document.createElement('span');
    this.textEl.className = 'ghud-text';

    this.container.appendChild(this.dotEl);
    this.container.appendChild(this.textEl);

    this.styleEl = document.createElement('style');
    const fontUrl = chrome.runtime.getURL('fonts/Outfit.woff2');
    this.styleEl.textContent = `
      @font-face {
        font-family: 'Outfit';
        font-style: normal;
        font-weight: 500 700;
        font-display: swap;
        src: url('${fontUrl}') format('woff2');
      }
      ${HUD_CSS}
    `;

    document.head.appendChild(this.styleEl);
    document.body.appendChild(this.container);

    // Start visible as idle dot
    this.container.classList.add('visible', 'idle');
  }

  update(state: FSMState | 'LOADING', gesture: Gesture, errorMessage?: string, warningMessage?: string, customText?: string): void {
    this.container.classList.add('visible');
    this.container.classList.remove('idle', 'detecting', 'confirming', 'triggered', 'warning', 'error', 'expanded', 'loading');

    if (errorMessage) {
      this.container.classList.add('error', 'expanded');
      this.textEl.textContent = errorMessage;
      this.scheduleAutoHide(5000);
      return;
    }

    if (warningMessage) {
      this.container.classList.add('warning', 'expanded');
      this.textEl.textContent = warningMessage;
      this.scheduleAutoHide(3000);
      return;
    }

    if (state === 'LOADING') {
      this.container.classList.add('loading', 'expanded');
      this.textEl.textContent = 'loading model...';
      return;
    }

    switch (state) {
      case 'IDLE':
        this.container.classList.add('idle');
        this.textEl.textContent = '';
        break;
      case 'DETECTING':
        this.container.classList.add('detecting');
        this.textEl.textContent = '';
        break;
      case 'CONFIRMING':
        this.container.classList.add('confirming');
        this.textEl.textContent = '';
        break;
      case 'TRIGGERED':
      case 'COOLDOWN':
        this.container.classList.add('triggered', 'expanded');
        this.textEl.textContent = customText || this.getActionText(gesture);
        const hideDelay = gesture === 'EXIT' ? 3000 : 800;
        this.scheduleAutoHide(hideDelay);
        break;
    }
  }

  showError(message: string): void {
    this.update('IDLE', 'NONE', message);
  }

  destroy(): void {
    if (this.autoHideTimeout) clearTimeout(this.autoHideTimeout);
    this.container.remove();
    this.styleEl.remove();
  }

  private scheduleAutoHide(ms: number): void {
    if (this.autoHideTimeout) clearTimeout(this.autoHideTimeout);
    this.autoHideTimeout = window.setTimeout(() => {
      this.container.classList.remove('expanded', 'triggered', 'warning', 'error', 'loading');
      this.container.classList.add('idle');
      this.textEl.textContent = '';
    }, ms);
  }

  private getActionText(gesture: Gesture): string {
    switch (gesture) {
      case 'NEXT': return '▲ NEXT';
      case 'PREV': return '▼ PREV';
      case 'PAUSE': return '⏸ PAUSE';
      case 'SPEED': return '⚡ SPEED';
      case 'EXIT': return '👋 EXIT';
      case 'NONE': return '';
      default:
        return '';
    }
  }
}

const HUD_CSS = `
  #gesture-v2-hud {
    position: fixed;
    bottom: 32px;
    right: 32px;
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 12px;
    box-sizing: border-box;
    border-radius: 100px;
    opacity: 0;
    transform: translateY(20px) scale(0.9);
    transition: all 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
    overflow: hidden;
    background: rgba(15, 15, 20, 0.65);
    backdrop-filter: blur(24px) saturate(200%);
    -webkit-backdrop-filter: blur(24px) saturate(200%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  /* Dynamic Gradient Glow behind the HUD */
  #gesture-v2-hud::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 100px;
    padding: 2px;
    background: conic-gradient(from 0deg, transparent 0%, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%, transparent 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: opacity 300ms ease;
    animation: ghud-spin 4s linear infinite;
    pointer-events: none;
  }

  #gesture-v2-hud.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  /* ── Dot-only mode (idle / detecting / confirming) ── */
  #gesture-v2-hud.idle,
  #gesture-v2-hud.detecting,
  #gesture-v2-hud.confirming {
    padding: 14px;
    border-radius: 50%;
  }

  #gesture-v2-hud.idle .ghud-text,
  #gesture-v2-hud.detecting .ghud-text,
  #gesture-v2-hud.confirming .ghud-text {
    display: none;
    opacity: 0;
  }

  #gesture-v2-hud.detecting::before,
  #gesture-v2-hud.confirming::before,
  #gesture-v2-hud.loading::before {
    opacity: 1;
  }

  /* ── Expanded pill mode (triggered / warning / error) ── */
  #gesture-v2-hud.expanded {
    padding: 10px 20px 10px 14px;
    border-radius: 100px;
  }

  #gesture-v2-hud.expanded .ghud-text {
    display: block;
    opacity: 1;
    animation: ghud-fade-in 300ms ease forwards;
  }

  /* ── Dot ── */
  .ghud-dot {
    flex-shrink: 0;
    border-radius: 50%;
    transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* idle: 8×8, grey, dim */
  #gesture-v2-hud.idle .ghud-dot {
    width: 8px;
    height: 8px;
    background: #6b7280;
    opacity: 0.5;
  }

  /* detecting: 12×12, blue, pulsing */
  #gesture-v2-hud.detecting .ghud-dot {
    width: 12px;
    height: 12px;
    background: #3b82f6;
    opacity: 1;
    box-shadow: 0 0 16px rgba(59, 130, 246, 0.8), 0 0 4px rgba(255, 255, 255, 0.8);
    animation: ghud-pulse 1.2s infinite alternate ease-in-out;
  }

  /* confirming: 12×12, amber */
  #gesture-v2-hud.confirming .ghud-dot {
    width: 12px;
    height: 12px;
    background: #f59e0b;
    opacity: 1;
    box-shadow: 0 0 16px rgba(245, 158, 11, 0.8), 0 0 4px rgba(255, 255, 255, 0.8);
    transform: scale(1.1);
  }

  /* triggered: 10x10 green */
  #gesture-v2-hud.triggered .ghud-dot {
    width: 10px;
    height: 10px;
    background: #10b981;
    box-shadow: 0 0 16px rgba(16, 185, 129, 0.8), 0 0 4px rgba(255, 255, 255, 0.8);
  }

  /* warning: amber */
  #gesture-v2-hud.warning .ghud-dot {
    width: 10px;
    height: 10px;
    background: #f59e0b;
    box-shadow: 0 0 12px rgba(245, 158, 11, 0.8);
  }

  /* error: red */
  #gesture-v2-hud.error .ghud-dot {
    width: 10px;
    height: 10px;
    background: #ef4444;
    box-shadow: 0 0 12px rgba(239, 68, 68, 0.8);
  }

  #gesture-v2-hud.loading .ghud-dot {
    width: 10px;
    height: 10px;
    background: #8b5cf6;
    box-shadow: 0 0 16px rgba(139, 92, 246, 0.8);
    animation: ghud-pulse 1s infinite alternate;
  }

  /* ── Text ── */
  .ghud-text {
    white-space: nowrap;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #fff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  }

  #gesture-v2-hud.triggered .ghud-text { color: #34d399; }
  #gesture-v2-hud.warning .ghud-text { color: #fbbf24; }
  #gesture-v2-hud.error .ghud-text { color: #f87171; }
  #gesture-v2-hud.loading .ghud-text { color: #c4b5fd; }

  @keyframes ghud-pulse {
    from { transform: scale(0.85); }
    to   { transform: scale(1.15); }
  }

  @keyframes ghud-fade-in {
    from { opacity: 0; transform: translateX(-4px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes ghud-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
`;
