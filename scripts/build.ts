/**
 * Build script for Gestro — Chrome Extension.
 * by Ramandeep Singh Chhabra.
 * Uses esbuild to bundle content script, background, and popup as IIFE modules.
 * Copies static assets (manifest, HTML, CSS, models, icons) to dist/.
 */
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

async function build(): Promise<void> {
  console.log('🔨 Building Gestro...\n');

  // Clean dist
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  // 1. Content script (IIFE — no ES modules in content scripts)
  // We intentionally keep production bundles readable for this open source
  // extension. No minification, and inline sourcemaps are enabled so shipped
  // output can still be inspected during debugging.
  console.log('  [1/3] Bundling content script...');
  await esbuild.build({
    entryPoints: [resolve(root, 'src/content/index.ts')],
    bundle: true,
    outfile: resolve(dist, 'content.js'),
    format: 'iife',
    target: 'chrome120',
    minify: false,
    sourcemap: 'inline',
    logLevel: 'warning',
    // Externalize chrome API (provided by browser)
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  // 2. Background service worker (IIFE)
  // Keep the background bundle readable for easier review and debugging.
  console.log('  [2/3] Bundling background service worker...');
  await esbuild.build({
    entryPoints: [resolve(root, 'src/background/service-worker.ts')],
    bundle: true,
    outfile: resolve(dist, 'background.js'),
    format: 'iife',
    target: 'chrome120',
    minify: false,
    sourcemap: 'inline',
    logLevel: 'warning',
  });

  // 3. Popup script (IIFE)
  // The popup is shipped in readable form so reviewers and users can inspect
  // the final bundle without needing a separate source map step.
  console.log('  [3/3] Bundling popup...');
  await esbuild.build({
    entryPoints: [resolve(root, 'src/popup/popup.ts')],
    bundle: true,
    outfile: resolve(dist, 'popup/popup.js'),
    format: 'iife',
    target: 'chrome120',
    minify: false,
    sourcemap: 'inline',
    logLevel: 'warning',
  });

  // Copy static files
  console.log('\n  Copying static assets...');

  cpSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
  cpSync(resolve(root, 'src/popup/popup.html'), resolve(dist, 'popup/popup.html'));
  cpSync(resolve(root, 'src/popup/popup.css'), resolve(dist, 'popup/popup.css'));

  // Copy open-source files
  if (existsSync(resolve(root, 'LICENSE'))) {
    cpSync(resolve(root, 'LICENSE'), resolve(dist, 'LICENSE'));
    console.log('  ✓ Copied LICENSE');
  }
  if (existsSync(resolve(root, '.gitignore'))) {
    cpSync(resolve(root, '.gitignore'), resolve(dist, '.gitignore'));
    console.log('  ✓ Copied .gitignore');
  }
  if (existsSync(resolve(root, 'README.md'))) {
    cpSync(resolve(root, 'README.md'), resolve(dist, 'README.md'));
    console.log('  ✓ Copied README.md');
  }
  if (existsSync(resolve(root, 'logo.png'))) {
    cpSync(resolve(root, 'logo.png'), resolve(dist, 'logo.png'));
    console.log('  ✓ Copied logo.png');
  }

  // Copy community health files
  for (const file of ['CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md']) {
    if (existsSync(resolve(root, file))) {
      cpSync(resolve(root, file), resolve(dist, file));
      console.log(`  ✓ Copied ${file}`);
    }
  }

  // Copy .github templates
  if (existsSync(resolve(root, '.github'))) {
    cpSync(resolve(root, '.github'), resolve(dist, '.github'), { recursive: true });
    console.log('  ✓ Copied .github/');
  }

  // Copy fonts
  if (existsSync(resolve(root, 'src/fonts'))) {
    cpSync(resolve(root, 'src/fonts'), resolve(dist, 'fonts'), { recursive: true });
    console.log('  ✓ Copied fonts/');
  }

  // Copy models (MediaPipe WASM + model)
  if (existsSync(resolve(root, 'models'))) {
    cpSync(resolve(root, 'models'), resolve(dist, 'models'), { recursive: true });
    console.log('  ✓ Copied models/');
  } else {
    console.warn('  ⚠ models/ directory not found — run "npm run download-models" first');
  }

  // Copy icons
  if (existsSync(resolve(root, 'icons'))) {
    cpSync(resolve(root, 'icons'), resolve(dist, 'icons'), { recursive: true });
    console.log('  ✓ Copied icons/');
  } else {
    console.warn('  ⚠ icons/ directory not found — generating placeholders...');
    mkdirSync(resolve(dist, 'icons'), { recursive: true });
    generatePlaceholderIcons(resolve(dist, 'icons'));
  }

  console.log('\n✅ Build complete! Load dist/ as unpacked extension in chrome://extensions/\n');
}

/**
 * Generates minimal placeholder PNG icons (solid color squares).
 * These are valid 1x1 PNGs scaled — enough to load the extension.
 */
function generatePlaceholderIcons(dir: string): void {
  // Minimal valid PNG: 1x1 pixel, purple (#7c3aed)
  // This is the smallest valid PNG file possible
  const png1x1 = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xd7, 0x63, 0xd8, 0xd0, 0xc0, 0x00, // compressed data
    0x00, 0x00, 0x04, 0x00, 0x01, 0xe7, 0x21, 0x70, //
    0x4e, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  for (const size of [16, 48, 128]) {
    writeFileSync(resolve(dir, `${size}.png`), png1x1);
  }
  console.log('  ✓ Generated placeholder icons');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
