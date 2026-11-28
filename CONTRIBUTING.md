# Contributing to NirnayDAG

Thank you for contributing to NirnayDAG!

## Development Setup

1. Clone the repository and install dependencies:
   ```bash
   npm ci
   ```
2. Run the full verification suite before opening a pull request:
   ```bash
   npm run check
   ```
   `npm run check` runs TypeScript type-checking (`npm run typecheck`), Oxlint (`npm run lint`), production builds (`npm run build`), and the Vitest suite (`npm run test`) in order so that `dist/cli.js` is up to date for CLI integration tests.
   Always run `npm run check` rather than `npm test` alone, because some tests run the built CLI.

## Branch Conventions

- Create feature or fix branches from `main` using descriptive names (e.g. `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, or `phase-<id>-<name>`).
- Keep commits focused and atomic with clear commit messages.

## Test Conventions

- Unit and integration tests live under `tests/` (and `src/__tests__/`), written with Vitest (`*.test.ts`).
- CLI integration tests execute the built CLI (`dist/cli.js`) or `src/cli/index.ts` against temporary fixture directories under `os.tmpdir()` and clean up after themselves.
- Security-sensitive changes (such as path-traversal checks or server binding) must include regression tests covering both POSIX and Windows path formats where applicable.
- Ensure `npm run check` passes with zero warnings or errors before submitting your PR.
