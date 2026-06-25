# Development

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Chrome ≥ 120

## Setup

```bash
git clone https://github.com/ramandeepsinghchhabra/Gestro.git
cd gestro
npm install
npm run download-models
npm run build
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Full production build → `dist/` |
| `npm run dev` | Watch mode — rebuilds on file changes |
| `npm run download-models` | Download MediaPipe hand tracking models |

## Project Layout

```
src/
├── background/       # Service worker
├── content/          # Content script, camera, recognizer, HUD
│   └── platforms/    # YouTube, Instagram, TikTok adapters
└── popup/            # Extension popup
scripts/              # Build scripts
```

## Adding a Platform

1. Create `src/content/platforms/{name}.ts` implementing the `PlatformAdapter` interface
2. Add the URL pattern to `manifest.json` content_scripts matches
3. Import and register in `src/content/platforms/index.ts`

The adapter interface requires: `next()`, `previous()`, `togglePause()`, `toggleSpeed()`, `exit()`, `getCurrentVideo()`, `destroy()`.

## Adding a Gesture

1. Add the gesture string to the `Gesture` type in `src/content/recognizer.ts`
2. Add a detection method (e.g. `isSixFingersUp()`)
3. Add the check in the `recognize()` method before the `NONE` fallback
4. Add the action mapping in `src/content/index.ts`
5. If needed, add a platform-specific implementation in the adapter

## Code Style

- TypeScript strict mode
- 2-space indentation
- camelCase for variables and functions
- PascalCase for classes and types
- No unused imports

## Testing

Manual testing is the primary approach:

1. Build with `npm run build`
2. Load `gestro/` in Chrome
3. Navigate to YouTube Shorts, Instagram Reels, or TikTok
4. Toggle the extension ON
5. Test each gesture in various lighting conditions

## Debugging

- Extension logs appear in the page console (F12)
- `logger.info()` is suppressed in production builds
- `logger.warn()` and `logger.error()` always show
- Background worker logs appear in `chrome://extensions` → service worker