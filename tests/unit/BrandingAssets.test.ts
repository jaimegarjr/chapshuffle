import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const docsHtml = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
const brandingRoot = path.join(root, 'shared/branding');
const docsBrandingRoot = path.join(root, 'docs/assets/branding');
const mirroredAssets = [
  'styles.css',
  'fog.js',
  'icons/shuffle.svg',
  'icons/github.svg',
  'icons/arrow-left.svg',
  'icons/kofi.svg',
  'images/favicon-16.png',
  'images/favicon-48.png',
  'images/small-promo-tile.png',
  'vendor/three.r134.min.js',
  'vendor/vanta.fog.0.5.24.min.js',
];

describe('shared branding assets', () => {
  test('the public site loads branding and animation code locally', () => {
    expect(docsHtml).toContain('./assets/branding/styles.css');
    expect(docsHtml).toContain('./assets/branding/vendor/three.r134.min.js');
    expect(docsHtml).toContain('./assets/branding/vendor/vanta.fog.0.5.24.min.js');
    expect(docsHtml).toContain('./assets/branding/fog.js');
    expect(docsHtml).not.toMatch(/<script[^>]+src=["']https?:\/\//);
  });

  test.each(mirroredAssets)('keeps %s in the canonical shared package', (asset) => {
    expect(fs.existsSync(path.join(brandingRoot, asset))).toBe(true);
  });

  test.each(mirroredAssets)('keeps the GitHub Pages copy of %s synchronized', (asset) => {
    expect(fs.readFileSync(path.join(docsBrandingRoot, asset))).toEqual(
      fs.readFileSync(path.join(brandingRoot, asset))
    );
  });

  test('disables the animated background for reduced motion', () => {
    const fogScript = fs.readFileSync(path.join(brandingRoot, 'fog.js'), 'utf8');
    expect(fogScript).toContain('prefers-reduced-motion: reduce');
    expect(fogScript).toContain('reducedMotion.matches');
  });

  test('the public homepage exposes install, trial, support, source, and privacy destinations', () => {
    expect(docsHtml).toContain(
      'https://chromewebstore.google.com/detail/chap-shuffle/dabkcpempohenngjmnaakjaajidnepda'
    );
    expect(docsHtml).toContain('https://youtu.be/pgQRcqh1u7U');
    expect(docsHtml).toContain('https://ko-fi.com/jaimegarjr');
    expect(docsHtml).toContain('https://github.com/jaimegarjr/chapshuffle');
    expect(docsHtml).toContain('href="#privacy"');
    expect(docsHtml).toContain('Shuffle once, keep listening');
    expect(docsHtml).toContain('Shape the queue');
    expect(docsHtml).toContain('Stay inside YouTube');
  });
});
