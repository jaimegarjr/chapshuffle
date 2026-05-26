# ChapShuffle – local development commands
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

# One-shot: type-check + test + build
ci: typecheck test build

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
