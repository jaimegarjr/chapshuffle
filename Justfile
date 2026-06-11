# chapshuffle – local development commands
# Install: https://github.com/casey/just

# Load GA secrets from .env when present (see .env.example)
set dotenv-load := true

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

# Bundle with explicitly supplied non-production analytics credentials.
build-analytics:
    yarn build:analytics

# Bundle with production analytics credentials. Intended for the protected release environment.
build-release:
    yarn build:release

# Rebuild on every file change (keep this running while developing)
dev:
    yarn watch

# Mirror shared/branding into docs/ after editing branding assets; commit the result
# (dist/ syncs automatically on build, and unit tests fail if the docs mirror drifts)
sync-branding:
    yarn sync:branding

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

# Run CI, replace the telemetry-free bundle with a credentialed release bundle, then package it.
release-zip: ci build-release
    bin/zip
