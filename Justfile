# chapshuffle – local development commands
# Install: https://github.com/casey/just

# Install dependencies and enable the pre-commit CI hook
install:
    yarn install
    git config core.hooksPath .githooks

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

# Serve the public homepage over HTTP (CSS mask icons don't load via file://)
serve-docs port="8000":
    npx serve docs -l {{port}}

# Format source files with Prettier
format:
    yarn format

# Check formatting without writing changes (CI-safe)
format-check:
    yarn format:check

# Base CI lane: static checks, unit tests, and a production build
ci: typecheck format-check test build

# Package dist/ into a zip ready for Chrome Web Store upload
zip: ci
    bin/zip
