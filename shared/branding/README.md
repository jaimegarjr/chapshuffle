# Shared branding assets

This directory is the canonical source for Chap Shuffle's public-site and extension-page branding.
`node scripts/sync-branding.js` mirrors it into `docs/assets/branding/` for GitHub Pages, while
`build.js` copies the same source into `dist/assets/branding/` for offline extension pages.

Pinned browser libraries:

- Three.js r134 (`vendor/three.r134.min.js`)
- Vanta Fog 0.5.24 (`vendor/vanta.fog.0.5.24.min.js`)

The copies are intentionally committed so Manifest V3 pages never execute remote code.
