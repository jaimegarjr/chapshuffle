const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { copyBrandingAssets } = require('./scripts/sync-branding');
const watch = process.argv.includes('--watch');
const prod = process.argv.includes('--prod');

// GA4 Measurement Protocol credentials — injected from environment, never committed.
// Missing credentials are treated as telemetry disabled rather than a build failure.
const gaMeasurementId = process.env.GA_MEASUREMENT_ID ?? '';
const gaApiSecret = process.env.GA_API_SECRET ?? '';

const config = {
  entryPoints: {
    content: 'src/content.ts',
    background: 'src/background.ts',
    popup: 'src/popup/popup.tsx',
    onboarding: 'src/onboarding/onboarding.tsx',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'browser',
  target: 'chrome100',
  sourcemap: watch ? 'inline' : false,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  define: {
    __DEV__: String(!prod),
    __GA_MEASUREMENT_ID__: JSON.stringify(gaMeasurementId),
    __GA_API_SECRET__: JSON.stringify(gaApiSecret),
  },
  minify: prod,
};

function copyStatic() {
  fs.mkdirSync('dist', { recursive: true });
  fs.mkdirSync('dist/icons', { recursive: true });
  copyBrandingAssets(path.resolve('dist/assets/branding'));
  fs.copyFileSync('manifest.json', 'dist/manifest.json');
  fs.copyFileSync('src/popup/popup.html', 'dist/popup.html');
  fs.copyFileSync('src/onboarding/onboarding.html', 'dist/onboarding.html');
  fs.copyFileSync('src/onboarding/onboarding.css', 'dist/onboarding.css');
  for (const size of [16, 48, 128]) {
    fs.copyFileSync(`icons/icon${size}.png`, `dist/icons/icon${size}.png`);
  }
}

async function main() {
  copyStatic();
  const ctx = await esbuild.context(config);
  if (watch) {
    await ctx.watch();
    console.log(
      '[chapshuffle] watching — reload the extension card in chrome://extensions after saving'
    );
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('[chapshuffle] build complete → dist/');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
