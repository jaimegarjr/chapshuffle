// Bundles TypeScript source into dist/ and copies static assets so that
// Chrome's "Load unpacked" only needs to be pointed at dist/.
const esbuild = require('esbuild');
const fs = require('fs');
const watch = process.argv.includes('--watch');

const config = {
  entryPoints: {
    content: 'src/content.ts',
    background: 'src/background.ts',
    popup: 'src/popup/popup.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'browser',
  target: 'chrome100',
  sourcemap: watch ? 'inline' : false,
};

function copyStatic() {
  fs.mkdirSync('dist', { recursive: true });
  fs.copyFileSync('manifest.json', 'dist/manifest.json');
  fs.copyFileSync('src/popup/popup.html', 'dist/popup.html');
}

async function main() {
  copyStatic();
  const ctx = await esbuild.context(config);
  if (watch) {
    await ctx.watch();
    console.log('[chapshuffle] watching — reload the extension card in chrome://extensions after saving');
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
