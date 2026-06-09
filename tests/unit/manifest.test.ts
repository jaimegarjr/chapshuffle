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

  test('does not declare redundant host permissions', () => {
    expect(manifest.host_permissions).toBeUndefined();
  });

  test('content script matches youtube.com pages', () => {
    const cs = manifest.content_scripts[0];
    expect(cs.matches).toContain('https://www.youtube.com/*');
    expect(cs.js).toContain('content.js');
  });

  test('background service worker is declared', () => {
    expect(manifest.background.service_worker).toBe('background.js');
  });
});
