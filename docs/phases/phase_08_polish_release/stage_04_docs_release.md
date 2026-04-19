# Phase 8 — Stage 4: Documentation & Release

> User + developer docs, changelog, release pipeline.
> Status: `[x]` complete · **Effort**: 12h

## Steps

- [x] **Step 1**: User docs — "Author a workflow" tutorial
  - File(s): `docs/user-guide/author.md`
  - Contents: Step-by-step: open editor, add palette items, connect, edit properties, save, run; with screenshots.
  - Effort: 3h

- [x] **Step 2**: Developer docs — "Register a custom node" tutorial
  - File(s): `docs/developer-guide/custom-node.md`
  - Contents: How to define a `NodeSpec`, register it with the registry, author a React component for it, test it; link to example repo.
  - Effort: 3h

- [x] **Step 3**: Changelog + release pipeline
  - File(s): `CHANGELOG.md`, `.github/workflows/release.yml`
  - Contents: Keep-a-Changelog format; release workflow triggered on `v*` tag push — runs full test matrix + Lighthouse + bundle size, then `npm publish` (library mode) or uploads Docker image (app mode).
  - Effort: 3h

- [x] **Step 4**: Final Phase 8 acceptance — full sweep
  - File(s): —
  - Contents: Walk all Phase 8 exit criteria; confirm coverage, bundle size, Lighthouse, a11y; score each step; mark the plan overall status.
  - Effort: 3h

## Acceptance for Stage 4

- All 4 steps `[x]` with score ≥ 90.
- Release pipeline tested with a dry-run tag.
- User + developer docs live under `docs/user-guide/` and `docs/developer-guide/`.
- Phase 8 scored ≥ 90 overall.
