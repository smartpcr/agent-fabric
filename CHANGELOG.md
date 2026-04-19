# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Visual workflow editor with drag-and-drop palette, canvas, and property grid
- Node types: Start, End, Task, Decision (binary + switch), Loop (while + foreach)
- Port system with typed connections, cardinality, and validation rules
- Property grid with auto-generated fields from Zod schemas
- Execution engine with real-time node/edge status visualization
- Undo/redo with temporal history (50-step limit)
- Auto-layout via ELK engine
- Persistence: auto-save to localStorage, manual save/load, JSON export/import
- Keyboard-only workflow authoring (node insertion, connection, navigation)
- Accessibility: axe-core zero violations, ARIA roles, screen reader announcements
- Theming: CSS custom properties, light/dark mode toggle, high-contrast support
- i18n scaffolding: English + French, locale switcher, ESLint enforcement
- Code-split Monaco editor (lazy-loaded CodeField)
- Performance: 500-node pan/zoom benchmark ≥ 55 fps, selector memoization audit
- Lighthouse CI: performance ≥ 90, accessibility ≥ 95, best-practices ≥ 90
- User guide: "Author a Workflow" tutorial with screenshots
- Developer guide: "Register a Custom Node" tutorial with examples
- CI pipeline: lint, typecheck, unit tests, coverage, build, bundle size check
- Release pipeline: tag-triggered workflow with full test matrix + publish

## [0.1.0] — Unreleased

Initial release.

[Unreleased]: https://github.com/smartpcr/agent-fabric/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/smartpcr/agent-fabric/releases/tag/v0.1.0
