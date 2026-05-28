const esbuild = require('esbuild');
const fs = require('fs');
const watch = process.argv.includes('--watch');
const prod = process.argv.includes('--prod');

const config = {
  entryPoints: {
    content: 'src/content.ts',
    background: 'src/background.ts',
    popup: 'src/popup/popup.tsx',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'browser',
  target: 'chrome100',
  sourcemap: watch ? 'inline' : false,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  define: { __DEV__: String(!prod) },
  minify: prod,
};

function copyStatic() {
  fs.mkdirSync('dist', { recursive: true });
  fs.mkdirSync('dist/icons', { recursive: true });
  fs.copyFileSync('manifest.json', 'dist/manifest.json');
  fs.copyFileSync('src/popup/popup.html', 'dist/popup.html');
  for (const size of [16, 48, 128]) {
    fs.copyFileSync(`icons/icon${size}.png`, `dist/icons/icon${size}.png`);
  }
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
