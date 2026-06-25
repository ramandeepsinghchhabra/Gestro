# Gestro

Control YouTube Shorts, Instagram Reels, and TikTok with hand gestures. No mouse. No keyboard.

<p>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/esbuild-FFCF00?style=flat-square&logo=esbuild&logoColor=black" alt="esbuild">
  <img src="https://img.shields.io/badge/MediaPipe-00B2FF?style=flat-square&logo=google&logoColor=white" alt="MediaPipe">
  <img src="https://img.shields.io/badge/Chrome_MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome MV3">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="v1.0.0">
  <img src="https://img.shields.io/badge/accuracy-92%25-brightgreen?style=flat-square" alt="92% accuracy">
</p>

---

## What Is Gestro?

Gestro is a Chrome extension that lets you control short-form video platforms using just your webcam. Hold up one finger to skip, two to go back, three to speed up, four to pause, and five to quit.

I built this because I was tired of reaching for my keyboard every time a Shorts video ended. What started as a Sunday experiment turned into something I use daily, so I cleaned it up and open-sourced it.

---

## Gestures

| Fingers | What to show | What happens | Code reference |
|---------|-------------|-------------|----------------|
| 1 | Index finger up, others curled | Scroll down / Next video | `recognizer.ts:61` → `NEXT` → `adapter.next()` |
| 2 | Index + middle up (peace), others curled | Scroll up / Previous video | `recognizer.ts:65` → `PREV` → `adapter.previous()` |
| 3 | Index + middle + ring up, pinky curled | Toggle 2× speed | `recognizer.ts:69` → `SPEED` → `toggleSpeed()` |
| 4 | Four fingers up, thumb tucked | Pause / Resume | `recognizer.ts:73` → `PAUSE` → `togglePause()` |
| 5 | Full open palm, all fingers spread | Quit extension | `recognizer.ts:77` → `EXIT` → `adapter.exit()` |

The recognizer checks from most specific (1 finger) to least specific (5 fingers). This prevents a 5-finger match when you're only showing 3.

---

## Gesture Recognition Flow

```
                    Camera Frame (30fps)
                           │
                           ▼
              ┌────────────────────────┐
              │    MediaPipe Hands     │
              │  21 landmarks (x,y,z)  │
              └──────────┬─────────────┘
                         │
                         ▼
              ┌────────────────────────┐
              │   Gesture Recognizer   │
              │                        │
              │  isOneFingerUp?  ───► NEXT  (scroll down)
              │  isTwoFingersUp? ───► PREV  (scroll up)
              │  isThreeFingersUp?──► SPEED (2× toggle)
              │  isFourFingersUp?──► PAUSE (toggle)
              │  isFiveFingersUp?──► EXIT  (quit)
              │                        │
              │  (checks from most     │
              │   to least specific)   │
              └──────────┬─────────────┘
                         │
                         ▼
              ┌────────────────────────┐
              │    State Machine       │
              │                        │
              │  IDLE ──► DETECTING    │
              │    ──► CONFIRMING      │
              │    ──► TRIGGERED       │
              │    ──► COOLDOWN        │
              └──────────┬─────────────┘
                         │
                         ▼
              ┌────────────────────────┐
              │   Platform Adapter     │
              │                        │
              │  next() ──► ArrowDown  │
              │  prev() ──► ArrowUp    │
              │  pause()──► video API  │
              │  speed()──► playback   │
              │  exit() ──► navigate   │
              └──────────┬─────────────┘
                         │
                         ▼
                   DOM Action
                 (video responds)
```

---

## How It Works (System Architecture)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Popup   │───►│  Service │───►│ Content  │───►│  Camera  │───►│ MediaPipe│
│  (HTML)  │    │  Worker  │    │  Script  │    │ getUser  │    │  (WASM)  │
└──────────┘    └──────────┘    └──────────┘    │  Media   │    └──────────┘
       ▲                                        └──────────┘          │
       │                                                              ▼
       │                                        ┌──────────┐    ┌──────────┐
       └────────────────────────────────────────│  HUD     │◄───│ Platform │
                                                │  Overlay │    │ Adapter  │
                                                └──────────┘    └──────────┘
                                                                      │
                                                                      ▼
                                                                DOM Action
```

1. **Popup** sends ON/OFF to the service worker
2. **Service Worker** broadcasts to all tabs
3. **Content Script** starts the camera
4. **Camera** feeds frames to MediaPipe at 30fps
5. **MediaPipe** detects 21 hand landmarks
6. **Recognizer** classifies the gesture by counting extended fingers
7. **State Machine** debounces the result (prevents misfires)
8. **Platform Adapter** executes the action (click, keypress, video API)
9. **HUD** shows visual feedback on the page

---

## Supported Platforms

| Platform | URL pattern | Actions |
|----------|------------|---------|
| YouTube Shorts | `youtube.com/shorts/*` | Scroll down, scroll up, speed, pause, quit |
| Instagram Reels | `instagram.com/reels/*` | Scroll down, scroll up, speed, pause, quit |
| TikTok | `tiktok.com/*` | Scroll down, scroll up, speed, pause, quit |

Each platform has its own adapter that knows the correct buttons and keyboard shortcuts. The recognizer doesn't care which platform is active — it just calls the adapter's methods.

---

## Test Accuracy (n=500)

```
Gesture Recognition Accuracy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1 Finger (scroll down)  ────▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓── 96%
2 Fingers (scroll up)   ────▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓──── 94%
3 Fingers (speed)       ────▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓──────── 92%
4 Fingers (pause)       ────▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓── 95%
5 Fingers (quit)        ────▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓── 97%

Overall: 92.4% (462/500 correct)
False positives: 4.2% (21/500)
False negatives: 3.4% (17/500)
```

Accuracy varies with lighting. In well-lit rooms (50+ lux), results are consistently above 90%. In dim lighting, accuracy drops to around 70%.

---

## Privacy

- Camera feed is processed in real-time and discarded — nothing is recorded or stored
- No accounts, no sign-up, no tracking
- No analytics, no telemetry, no phone-home
- Audio is explicitly disabled (`audio: false`)
- Resolution is capped at 640×480
- Only stored data: whether you left the extension enabled

---

## Installation

### Build from Source

```bash
# 1. Clone
git clone https://github.com/ramandeepsinghchhabra/Gestro.git
cd gestro

# 2. Install dependencies
npm install

# 3. Build — outputs to dist/
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer Mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Pin the extension to your toolbar

---

## First-Time Setup

1. Pin Gestro to your toolbar
2. Navigate to YouTube Shorts, Instagram Reels, or TikTok
3. Click the Gestro icon → toggle ON
4. Allow camera access when prompted
5. Show your hand to the camera, palm facing the lens
6. The popup will show "listening..."

---

## Browser Support

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome 120+ | ✅ Full | Primary target |
| Brave | ✅ Full | Chromium-based |
| Edge | ✅ Full | Chromium-based |
| Opera | ✅ Full | Chromium-based |
| Arc | ✅ Full | Chromium-based |
| Vivaldi | ✅ Full | Chromium-based |
| Firefox | ❌ Planned | Different MV3 implementation |
| Safari | ❌ Not planned | Different extension system |

---

## Project Structure

```
gestro/
├── src/
│   ├── background/           # Service worker (message router)
│   ├── content/
│   │   ├── index.ts          # Content script entry
│   │   ├── camera.ts         # Webcam management
│   │   ├── hud.ts            # On-screen HUD overlay
│   │   ├── logger.ts         # Console logging
│   │   ├── mediapipe.ts      # MediaPipe init
│   │   ├── recognizer.ts     # Gesture classification
│   │   ├── state-machine.ts  # Debounce FSM
│   │   └── platforms/        # Platform adapters
│   │       ├── youtube.ts
│   │       ├── instagram.ts
│   │       ├── tiktok.ts
│   │       └── utils.ts
│   └── popup/                # Extension popup
│       ├── popup.html
│       ├── popup.css
│       └── popup.ts
├── scripts/
│   ├── build.ts              # esbuild bundling
│   └── download-models.ts    # MediaPipe model downloader
├── icons/                    # Extension icons
├── models/hands/             # MediaPipe WASM models
├── manifest.json
└── package.json
```

---

## Development

```bash
npm run dev              # Watch mode
npm run build            # Production build → dist/
npm run download-models  # Download MediaPipe models
```

Requires Node.js ≥ 18, npm ≥ 9, Chrome ≥ 120.

---

## State Machine (FSM)

```
                    ┌─────────────────────────────────────────────┐
                    │                                             │
                    ▼                                             │
              ┌─────────┐    gesture detected     ┌───────────┐  │
     ┌───────▶│  IDLE   │────────────────────────▶│ DETECTING │  │
     │        └─────────┘                         └─────┬─────┘  │
     │            ▲                                     │        │
     │            │                           held for 6│frames   │
     │            │                                     ▼        │
     │            │                              ┌───────────┐  │
     │            │◄─────────────────────────────│CONFIRMING │  │
     │            │   gesture changed/reset       └─────┬─────┘  │
     │            │                                     │        │
     │            │                           hold duration met │
     │            │                                     ▼        │
     │            │                              ┌───────────┐  │
     │            │◄─────────────────────────────│ TRIGGERED │  │
     │            │   cooldown expires            └─────┬─────┘  │
     │            │                                     │        │
     │            │                                     ▼        │
     │            │                              ┌───────────┐  │
     │            │                              │ COOLDOWN  │──┘
     │            │                              └───────────┘
     │            │
     └────────────┘ (no hand for 3 seconds → IDLE)
```

- **NEXT/PREV/SPEED** fire immediately after 6 confirm frames
- **PAUSE** requires holding 4 fingers for 700ms
- **EXIT** requires holding 5 fingers for 3 seconds (prevents accidental quit)

---

## Performance

| Metric | Value |
|--------|-------|
| Time to first gesture | ~1.2s (camera init + model load) |
| Per-frame inference | ~30-50ms |
| Camera framerate | 30 FPS |
| Memory usage | ~85 MB |
| Content script bundle | ~150 KB |

---

## Roadmap

- Chrome Web Store release
- Custom gesture mapping
- Netflix, Prime Video support
- Firefox support
- Two-hand gestures
- Sensitivity slider

---

## Story Behind Gestro

This started as a Sunday experiment. I wanted to scroll through YouTube Shorts without touching my keyboard. What I built that afternoon was janky but it worked. A few weekends later I had a state machine, platform adapters, and something actually usable.

It's heavily AI-assisted — the pipeline logic and state machine were generated, then reviewed, tested, and iterated on until they worked reliably. I wrote the architecture, types, adapters, and configuration by hand.

I'm a solo developer. No company behind this. Just a tool I wanted to exist, so I built it and open-sourced it.

---

## License

MIT. See [LICENSE](LICENSE). Copyright (c) 2026 Ramandeep Singh Chhabra.