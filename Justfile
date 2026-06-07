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

# Run end-to-end browser tests; optionally pass `debug` and a test name or spec path
e2e-test mode="headless" target="":
    bin/e2e-test "{{mode}}" "{{target}}"

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

# Base CI lane: static checks, unit tests, and a production build
ci: typecheck format-check test build

# Expanded CI lane with the end-to-end browser suite
ci-e2e: ci e2e-test

# Package dist/ into a zip ready for Chrome Web Store upload
zip: ci
    bin/zip

# Start the manual release preparation workflow
# Usage: just release 1.2.3
release version:
    #!/usr/bin/env bash
    set -e
    if [ -z "{{version}}" ]; then echo "Usage: just release X.Y.Z"; exit 1; fi
    if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
      gh workflow run prepare-release.yml -f version="{{version}}"
      echo "  → started Prepare Release for {{version}}"
    else
      echo "Open GitHub Actions → Prepare Release, then run it with version {{version}}"
    fi

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
