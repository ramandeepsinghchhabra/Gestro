# Troubleshooting

## Extension Won't Load

**Enable Developer Mode** at `chrome://extensions/` (toggle in top-right). Load the `gestro/` folder, not the parent folder.

## Camera Not Starting

1. Click the lock/camera icon in Chrome's address bar and verify camera permission is set to "Allow"
2. Toggle the extension OFF then ON
3. Refresh the page
4. No other application should be using the camera

If permission was denied, reset it at `chrome://settings/content/camera` and reload.

## Gestures Not Detected

- Make sure you're on a supported platform (YouTube Shorts, Instagram Reels, TikTok)
- Room must be well-lit — dim lighting reduces accuracy significantly
- Keep your palm facing the camera, all fingers visible
- Plain backgrounds work better than complex ones
- Stay within 30-80 cm of the camera
- No other app should be using the camera

## Gestures Detected Inconsistently

- Improve lighting
- Reduce background movement
- Ensure your whole hand is visible
- Try a different camera angle
- Keep hand gestures deliberate but not too fast

## Extension Icon Shows Error (!)

Click the icon to see the error message. Usually this means camera permission was denied. Reset permission in Chrome settings and toggle the extension ON again.

## Build Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run download-models
npm run build
```

## Console Errors

| Message | Cause | Fix |
|---------|-------|-----|
| `Camera not found` | No webcam detected | Connect a webcam |
| `Permission denied` | Camera blocked in settings | Allow camera access in Chrome settings |
| `Model load timeout` | MediaPipe model took too long | Run `npm run download-models` |
| `No video element found` | Not on a supported page | Navigate to Shorts/Reels |

## Still Stuck?

Open a [GitHub issue](https://github.com/ramandeepsinghchhabra/Gestro/issues) with:
- Chrome version
- OS version
- Steps to reproduce
- Console errors (F12 → Console)