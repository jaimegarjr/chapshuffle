// esbuild bundles TypeScript source into dist/ for Chrome to load unpacked.
const esbuild = require('esbuild');
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

async function main() {
  const ctx = await esbuild.context(config);
  if (watch) {
    await ctx.watch();
    console.log('[chapshuffule] watching — edit & reload the extension in chrome://extensions');
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
