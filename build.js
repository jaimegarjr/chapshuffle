// Bundles TypeScript source into dist/ and copies manifest.json so that
// Chrome's "Load unpacked" only needs to be pointed at dist/.
const esbuild = require('esbuild');
const fs = require('fs');
const watch = process.argv.includes('--watch');

const config = {
  entryPoints: {
    content: 'src/content.ts',
    background: 'src/background.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'browser',
  target: 'chrome100',
  sourcemap: watch ? 'inline' : false,
};

function copyManifest() {
  fs.mkdirSync('dist', { recursive: true });
  fs.copyFileSync('manifest.json', 'dist/manifest.json');
}

async function main() {
  copyManifest();
  const ctx = await esbuild.context(config);
  if (watch) {
    await ctx.watch();
    console.log('[chapshuffule] watching — edit src/, then reload the extension card in chrome://extensions');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log('[chapshuffule] build complete → dist/');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
