# Gestro v1.0.0

**Build date:** 2026-06-25  
**Author:** Ramandeep Singh Chhabra  
**License:** MIT

## Browser Support

- Chrome 120+ (primary target)
- Brave, Edge, Opera, Arc, Vivaldi — any Chromium-based browser
- Firefox — not yet supported
- Safari — not supported

## Installation

1. Download the extension ZIP or build from source
2. Open `chrome://extensions/`
3. Enable Developer Mode (top-right)
4. Drag and drop the ZIP file, or click "Load unpacked" and select the `gestro/` folder

## Build from Source

```bash
git clone https://github.com/ramandeepsinghchhabra/Gestro.git
cd gestro
npm install
npm run download-models
npm run build
```

Load the `gestro/` folder as an unpacked extension.

## What's Inside

- Hand gesture control for YouTube Shorts, Instagram Reels, and TikTok
- 5 gestures: 1 finger (scroll down), 2 fingers (scroll up), 3 fingers (2× speed), 4 fingers (pause/resume), 5 fingers (quit)
- 100% client-side processing — no data leaves your machine
- MediaPipe hand tracking with GPU acceleration

## Known Limitations

- Requires good lighting for reliable gesture detection
- Single hand only
- Camera permission must be granted by the user
- ~85 MB memory usage (MediaPipe model)