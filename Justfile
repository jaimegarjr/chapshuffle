# chapshuffle – local development commands
# Install: https://github.com/casey/just

# Install dependencies
install:
    yarn install

# Run the test suite
test:
    yarn test

# Run tests in watch mode (re-runs on file save)
test-watch:
    yarn test --watchAll

# Type-check without emitting files
typecheck:
    yarn tsc --noEmit

# Bundle the extension into dist/ (required before loading in Chrome)
build:
    yarn build

# Rebuild on every file change (keep this running while developing)
dev:
    yarn watch

# Format source files with Prettier
format:
    yarn format

# Check formatting without writing changes (CI-safe)
format-check:
    yarn format:check

# One-shot: type-check + test + production build (debug logs stripped, minified)
ci: typecheck format-check test
    yarn build:prod

# Package dist/ into a zip ready for Chrome Web Store upload
zip: ci
    #!/usr/bin/env bash
    VERSION=$(node -p "require('./manifest.json').version")
    rm -f chapshuffle-*.zip
    cd dist && zip -r ../chapshuffle-v$VERSION.zip .
    echo "  → chapshuffle-v$VERSION.zip ready for Chrome Web Store upload"

# Bump manifest.json version, commit, and push a tag — triggers the release workflow
# Usage: just release 1.2.3
release version:
    #!/usr/bin/env bash
    set -e
    if [ -z "{{version}}" ]; then echo "Usage: just release X.Y.Z"; exit 1; fi
    if ! git diff --quiet || ! git diff --cached --quiet; then
      echo "error: working tree is dirty — commit or stash changes first"; exit 1
    fi
    node -e "
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
      m.version = '{{version}}';
      fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2) + '\n');
    "
    git add manifest.json
    git commit -m "chore: release v{{version}}"
    git tag "v{{version}}"
    git push origin HEAD "v{{version}}"
    echo "  → tagged v{{version}} and pushed — release workflow is running"

# Tell user how to load the extension in Chrome
load:
    @echo ""
    @echo "  1. Run:  just build"
    @echo "  2. Open: chrome://extensions"
    @echo "  3. Enable 'Developer mode' (top-right toggle)"
    @echo "  4. Click 'Load unpacked'"
    @echo "  5. Select the dist/ folder: $(pwd)/dist"
    @echo ""
    @echo "  Tip: run 'just dev' to auto-rebuild on file changes,"
    @echo "       then click the refresh icon on the extension card after each rebuild."
    @echo ""
