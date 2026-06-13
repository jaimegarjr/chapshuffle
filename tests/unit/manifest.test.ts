import * as fs from 'fs';
import * as path from 'path';

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'manifest.json'), 'utf8'));

describe('manifest.json', () => {
  test('targets Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test('declares only the storage permission', () => {
    expect(manifest.permissions).toEqual(['storage']);
  });

  test('host permissions are narrowly scoped to GA4 collection endpoints', () => {
    expect(manifest.host_permissions).toContain('https://www.google-analytics.com/mp/collect');
    expect(manifest.host_permissions).toContain(
      'https://www.google-analytics.com/debug/mp/collect'
    );
    // No wildcards — keep the surface minimal
    const wildcards = (manifest.host_permissions as string[]).filter((p) => p.includes('*'));
    expect(wildcards).toHaveLength(0);
  });

  test('content script matches youtube.com pages', () => {
    const cs = manifest.content_scripts.find((c: { js: string[] }) => c.js.includes('content.js'));
    expect(cs).toBeDefined();
    expect(cs.matches).toContain('https://www.youtube.com/*');
  });

  test('page-world chapter reader runs in the MAIN world at document_start', () => {
    const cs = manifest.content_scripts.find((c: { js: string[] }) =>
      c.js.includes('pageChapters.js')
    );
    expect(cs).toBeDefined();
    expect(cs.matches).toContain('https://www.youtube.com/*');
    expect(cs.world).toBe('MAIN');
    expect(cs.run_at).toBe('document_start');
  });

  test('declares the minimum Chrome version required for world: MAIN', () => {
    expect(manifest.minimum_chrome_version).toBe('111');
  });

  test('background service worker is declared', () => {
    expect(manifest.background.service_worker).toBe('background.js');
  });
});
