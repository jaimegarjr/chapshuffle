const fs = require('fs');
const path = require('path');

const source = path.resolve('shared/branding');

function copyBrandingAssets(destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, {
    recursive: true,
    filter: (assetPath) => path.basename(assetPath) !== 'README.md',
  });
}

if (require.main === module) {
  copyBrandingAssets(path.resolve('docs/assets/branding'));
  console.log('[chapshuffle] synced shared branding → docs/assets/branding/');
}

module.exports = { copyBrandingAssets };
