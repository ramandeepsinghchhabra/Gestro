/**
 * Copies MediaPipe WASM runtime from node_modules into the models directory.
 * Run with: npm run download-models
 */
import { existsSync, mkdirSync, cpSync, appendFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const modelsDir = resolve(rootDir, 'models', 'hands');

function copyHandsModel(): void {
  const handsSourceDir = resolve(rootDir, 'node_modules', '@mediapipe', 'hands');
  if (!existsSync(handsSourceDir)) {
    throw new Error(`@mediapipe/hands not found at ${handsSourceDir}. Run npm install first.`);
  }

  console.log('  ⬇ Copying @mediapipe/hands files from node_modules...');
  cpSync(handsSourceDir, modelsDir, { recursive: true });
  console.log('  ✓ Files copied successfully.');

  // Patch the WASM JS loaders to force attach their functions to the global window
  // When loaded via ES import(), their UMD wrappers fail to attach to window.
  const wasmBin = resolve(modelsDir, 'hands_solution_wasm_bin.js');
  const simdWasmBin = resolve(modelsDir, 'hands_solution_simd_wasm_bin.js');

  const patchScript = `
if (typeof window !== 'undefined') {
  if (typeof createMediapipeSolutionsWasm !== 'undefined') window.createMediapipeSolutionsWasm = createMediapipeSolutionsWasm;
  if (typeof createMediapipeSolutionsSimdWasm !== 'undefined') window.createMediapipeSolutionsSimdWasm = createMediapipeSolutionsSimdWasm;
}
`;

  if (existsSync(wasmBin)) {
    const contents = readFileSync(wasmBin, 'utf8');
    // Idempotent patch: only append the loader fix if it is not already present.
    if (!contents.includes('window.createMediapipeSolutionsWasm = createMediapipeSolutionsWasm')) {
      appendFileSync(wasmBin, patchScript);
    }
  }
  if (existsSync(simdWasmBin)) {
    const contents = readFileSync(simdWasmBin, 'utf8');
    // Idempotent patch: only append the loader fix if it is not already present.
    if (!contents.includes('window.createMediapipeSolutionsSimdWasm = createMediapipeSolutionsSimdWasm')) {
      appendFileSync(simdWasmBin, patchScript);
    }
  }
  console.log('  ✓ Patched WASM loaders for ES module compatibility.');
}

async function main(): Promise<void> {
  console.log('📦 Setting up MediaPipe models...\n');

  mkdirSync(modelsDir, { recursive: true });

  copyHandsModel();

  console.log('\n✅ All models ready.\n');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
