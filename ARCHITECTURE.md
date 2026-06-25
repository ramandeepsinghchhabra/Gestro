# Architecture

## System Overview

```
                ┌──────────────────────┐
                │    Chrome Extension   │
                │                      │
  ┌──────────┐  │  ┌──────────────┐   │
  │  Popup   │──┼─▶│   Service    │   │
  │  (HTML)  │  │  │   Worker     │   │
  └──────────┘  │  └──────┬───────┘   │
                │         │            │
                │  chrome.tabs.sendMessage
                │         │            │
                │  ┌──────▼───────┐   │
                │  │   Content    │   │
                │  │   Script     │   │
                │  │  (injected)  │   │
                │  └──────┬───────┘   │
                │         │            │
                │  ┌──────▼───────┐   │
                │  │   Camera     │   │
                │  │  (getUserMedia)│   │
                │  └──────┬───────┘   │
                │         │            │
                │  ┌──────▼───────┐   │
                │  │   MediaPipe  │   │
                │  │   (WASM)     │   │
                │  └──────┬───────┘   │
                │         │            │
                │  ┌──────▼───────┐   │
                │  │  Recognizer  │   │
                │  └──────┬───────┘   │
                │         │            │
                │  ┌──────▼───────┐   │
                │  │    FSM       │   │
                │  └──────┬───────┘   │
                │         │            │
                │  ┌──────▼───────┐   │
                │  │   Platform   │   │
                │  │   Adapter    │   │
                │  └──────┬───────┘   │
                │         │            │
                │         ▼            │
                │    DOM Action        │
                │  (click, keypress)   │
                └──────────────────────┘
```

## Components

### Background Service Worker
File: `src/background/service-worker.ts`
- Listens for `GET_ENABLED`, `SET_ENABLED`, `TOGGLE` messages from popup
- Persists enabled state in `chrome.storage.local`
- Broadcasts `EXTENSION_TOGGLE` to all matching tabs
- Stateless — just routes messages

### Content Script
File: `src/content/index.ts`
- Injected into YouTube, Instagram, and TikTok pages
- Reads persisted state and starts/stops the gesture pipeline
- Listens for SPA navigation via patched `history.pushState`
- Manages camera lifecycle, MediaPipe lifecycle, and HUD

### Camera
File: `src/content/camera.ts`
- Requests `getUserMedia` with `audio: false`, 640×480, front-facing
- Feeds each frame through MediaPipe
- Returns landmark arrays to the recognizer callback

### MediaPipe
File: `src/content/mediapipe.ts`
- Loads the hand tracking WASM model
- Creates a `Hand` instance from `@mediapipe/hands`
- Processes each video frame and returns 21 landmarks

### Gesture Recognizer
File: `src/content/recognizer.ts`
- Pure function — no state
- Checks fingertip Y positions against MCP (knuckle) positions
- Checks from most specific (1 finger) to least specific (5 fingers)
- Returns `{ gesture, confidence }`

| Fingers | Condition | Output |
|---------|-----------|--------|
| 1 | Index extended, middle/ring/pinky curled | `NEXT` |
| 2 | Index + middle extended, ring/pinky curled | `PREV` |
| 3 | Index + middle + ring extended, pinky curled | `SPEED` |
| 4 | Index + middle + ring + pinky extended, thumb not | `PAUSE` |
| 5 | All fingers + thumb extended | `EXIT` |

### State Machine
File: `src/content/state-machine.ts`
- Debounces gesture results
- States: IDLE → DETECTING → CONFIRMING → TRIGGERED → COOLDOWN
- Prevents accidental triggers and rapid-fire actions

### HUD
File: `src/content/hud.ts`
- Shows a semi-transparent overlay with current gesture state
- Updates on every frame cycle

### Platform Adapters
Files: `src/content/platforms/{youtube,instagram,tiktok}.ts`
- Each adapter implements the same interface: `next()`, `previous()`, `togglePause()`, `toggleSpeed()`, `exit()`
- YouTube uses native button clicks + keyboard fallbacks
- Instagram and TikTok use similar strategies with platform-specific selectors

### Popup
Files: `src/popup/{html,css,ts}`
- Shows extension state, camera status, platform, and gesture reference
- Lightweight — communicates only with the service worker

## Data Flow

```
Popup toggle ON
  → Service worker persists state
  → Broadcasts EXTENSION_TOGGLE=true
  → Content script starts camera
  → Camera frames flow to MediaPipe
  → Recognizer classifies landmarks
  → State machine debounces
  → Platform adapter executes DOM action
  → HUD shows feedback
```

## Gesture Detection Details

The recognizer uses MediaPipe's 21-point hand landmark model. Each landmark has x, y, z coordinates normalized to [0,1]. Y increases downward (0 = top of frame).

A finger is "extended" when `mcp.y - tip.y > 0.05` (tip is clearly above the knuckle).
A finger is "curled" when `tip.y - pip.y > 0.04` (tip is below the middle joint).
The thumb is "extended" when `|tip.x - wrist.x| > |mcp.x - wrist.x|`.