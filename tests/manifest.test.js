const fs = require('fs');
const path = require('path');

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8')
);

describe('manifest.json', () => {
  test('targets Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  test('declares only activeTab and storage permissions', () => {
    expect(manifest.permissions).toEqual(expect.arrayContaining(['activeTab', 'storage']));
    expect(manifest.permissions.length).toBe(2);
  });

  test('host permission is scoped to youtube.com', () => {
    expect(manifest.host_permissions).toContain('https://www.youtube.com/*');
    expect(manifest.host_permissions.length).toBe(1);
  });

  test('content script matches youtube.com pages', () => {
    const cs = manifest.content_scripts[0];
    expect(cs.matches).toContain('https://www.youtube.com/*');
    expect(cs.js).toContain('src/content.js');
  });

  test('background service worker is declared', () => {
    expect(manifest.background.service_worker).toBe('src/background.js');
  });
});
