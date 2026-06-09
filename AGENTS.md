# ChapShuffle — Agent Instructions

ChapShuffle is a Chrome extension (Manifest V3, TypeScript + Preact) that shuffles
YouTube video chapters. All coding agents (Claude Code, Codex, etc.) read this file.

Global guidance (commit/PR style, etc.) lives in `~/.agents/AGENTS.md`; follow it here too.

## Tooling

- Use **yarn**, never npm, for all scripts.
- Prefer the `just` recipes over raw yarn commands: `just ci` (typecheck + format-check +
  unit tests + build), `just test`, `just typecheck`, `just format`, `just build`,
  `just e2e-test` (Playwright), `just dev` (watch mode).
- A git pre-commit hook ([.githooks/pre-commit](.githooks/pre-commit), enabled by
  `just install`) runs `just ci` on every commit — never bypass it with `--no-verify`.
- `just build` bundles into `dist/`; load it via chrome://extensions → "Load unpacked".

## Project conventions

- Unit tests live in `tests/unit/` (Jest + jsdom); e2e tests in `tests/e2e/` (Playwright).
- The "Enable Shuffle" toggle controls auto-advance only — the queue panel stays usable
  when it is off. Don't gate the whole extension behind it.
- Releases go through `just release X.Y.Z`, which triggers the Prepare Release workflow.
