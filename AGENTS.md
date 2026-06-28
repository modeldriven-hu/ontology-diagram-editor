# Repository Guidelines

## Project Structure & Module Organization

This repository is a TypeScript VS Code extension. Extension entry points live in `src/`, with `src/extension.ts` registering contributed commands from `package.json`. Tests live under `src/test/` and are compiled to `out/` during test preparation. Production bundles are emitted to `dist/` by `esbuild.js`. Project documentation and acceptance-test notes live in `docs/`, with feature specs in `docs/features/`, acceptance criteria in `docs/acceptance-tests/`, and diagrams in `docs/diagrams/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run compile`: type-check, lint, and bundle the extension for development.
- `npm run watch`: run TypeScript and esbuild watchers in parallel during active development.
- `npm run package`: create a production bundle via esbuild after type-checking and linting.
- `npm test`: compile tests, compile the extension, lint, then run VS Code extension tests with `vscode-test`.
- `npm run lint` and `npm run check-types`: run ESLint and strict TypeScript checks independently.

## Coding Style & Naming Conventions

Write TypeScript targeting ES2022 with `strict` type checking enabled. Follow the existing VS Code extension pattern: exported `activate` and `deactivate` functions, command IDs matching `package.json`, and disposables pushed into `context.subscriptions`. Use tabs for indentation in `src/*.ts`, semicolons, strict equality, and braces for control flow. ESLint warns on import naming that is not `camelCase` or `PascalCase`.

## Testing Guidelines

Tests use Mocha with Node `assert` and the VS Code test runner. Place tests in `src/test/` with the `*.test.ts` suffix, grouped with `suite(...)` and `test(...)`. Prefer behavior-focused tests around commands, document handling, and extension activation. Run `npm test` before submitting changes; use `npm run compile-tests` when only checking test compilation.

## Commit & Pull Request Guidelines

This repository currently has no commit history, so use clear, imperative commit messages such as `Add diagram persistence tests` or `Fix command activation`. Keep commits focused on one logical change. Pull requests should describe the change, list validation commands run, link related issues or docs, and include screenshots or short recordings for user-visible editor or canvas changes.

## Security & Configuration Tips

Do not commit generated `dist/` or `out/` artifacts unless release packaging explicitly requires them. Keep extension settings and contributed commands documented in `package.json`, and avoid hard-coded local paths or machine-specific configuration.
