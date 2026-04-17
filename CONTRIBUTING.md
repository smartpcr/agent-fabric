# Contributing to Agent Fabric

Thank you for contributing! This guide covers conventions and processes for the project.

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | Use when…                                |
| ---------- | ---------------------------------------- |
| `feat`     | Adding a new feature                     |
| `fix`      | Fixing a bug                             |
| `docs`     | Documentation only                       |
| `style`    | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring (no feature/fix)      |
| `test`     | Adding or updating tests                 |
| `chore`    | Build, tooling, dependency updates       |
| `ci`       | CI/CD workflow changes                   |

### Scope

Use the phase/stage/step reference when applicable:

```
feat(step4): add zustand store skeleton
fix(s2-step2): correct panel collapse behavior
```

## Branch Naming

```
<type>/<short-description>
```

Examples:

- `feat/canvas-drag-drop`
- `fix/palette-collapse`
- `phase-loop/p0-s1-step3`

## Development Loop

```bash
npm run dev          # Start dev server
npm run lint         # ESLint strict TS rules
npm run typecheck    # tsc --noEmit
npm run test         # Vitest unit tests
npm run test:coverage # Coverage with 100% enforcement
npm run e2e          # Playwright (build first)
```

All checks must pass before opening a PR.

## Pull Request Process

1. Create a branch from `main` following the naming convention above.
2. Make changes and commit using conventional commits.
3. Ensure all CI checks pass locally:
   - `npm run lint` — zero errors
   - `npm run typecheck` — zero errors
   - `npm run test:coverage` — 100% coverage on `src/**`
4. Fill out the PR template completely.
5. Link the relevant phase/stage/step in the PR description.
6. Request review from at least one maintainer.

## Code Standards

- **TypeScript strict mode** — `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **Path aliases** — use `@/*` for `src/*` imports
- **Accessibility** — all interactive elements must have ARIA labels; use `jsx-a11y` lint rules
- **Testing** — every new `src/` file must have corresponding test coverage
- **No secrets** — never commit credentials, tokens, or keys

## Accessibility

- Use semantic HTML and ARIA attributes.
- Test keyboard navigation for new interactive components.
- Include accessibility notes in PR descriptions when adding UI changes.
