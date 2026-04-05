---
name: component-refactor
description: >-
  Splits large React components into smaller files without changing behavior:
  separates presentation from logic, extracts reusable pieces, and preserves
  props, state flow, and side effects. Use when refactoring oversized components,
  extracting hooks or subcomponents, separating UI from business logic, or when
  the user mentions component split, decomposition, or "too big" JSX files.
---

# Component refactor (split without behavior change)

## Non-negotiables

- **Do not change logic** — Same conditions, same handlers, same data transformations, same effects and dependencies. Refactor is structure-only unless the user explicitly asks for a bugfix or feature change.
- **Keep behavior identical** — Same user-visible output, interactions, loading/error states, and navigation. Prefer mechanical moves (cut/paste into new files) over rewrites.
- **Separate UI from logic** — Move state, data fetching, derived values, and event orchestration into custom hooks or thin container modules; keep presentational components mostly props + JSX.
- **Create reusable components** — Extract only when duplication exists or a subtree has a clear, stable API (props in, JSX/events out). Avoid premature abstraction; one-off extractions are fine as `FooSection.jsx` without forcing a "design system."
- **Minimal diff per step** — Especially in very large files (e.g. a single giant `App.jsx`): extract one coherent slice at a time; do not rewrite the whole file in one pass.

## Workflow

1. **Map the file** — Identify natural boundaries: sections of JSX, repeated blocks, hooks grouped with specific UI, or `useEffect` clusters tied to one feature.
2. **Choose extraction order** — Start with leaf UI (dumb components) or with a custom hook if logic is tangled; avoid circular imports.
3. **Define stable contracts** — New components/hooks receive explicit props/return values; match existing naming and patterns in the repo (`components/`, `hooks/`).
4. **Move code** — Copy types, constants, and imports with the extracted code; re-export or update imports in the parent only as needed.
5. **Verify** — Mentally trace props and callbacks from parent to child; ensure keys, refs, and context providers still wrap the same subtree.

## UI vs logic (practical split)

| Keep in presentation | Move to hook / helper |
|----------------------|------------------------|
| Layout, markup, conditional render from props | `useState`, `useReducer`, `useEffect`, subscriptions |
| Styling and static labels | Fetch/mutate, parsing, validation, derived memoized data |
| Mapping lists with props from parent | Debounce, timers, non-UI side effects |

Hooks should return what the view needs (data + handlers), not expose internal implementation details unless already the project pattern.

## Reusability

- Prefer **composition** (children, render props, small prop surfaces) over copying state upward unnecessarily.
- If two places need the same UI, extract a component with a **minimal prop list**; do not thread entire app state through "god props."
- Match **existing** memoization (`React.memo`, `useCallback`) only if the parent file already uses that pattern; do not introduce optimization that changes render timing in subtle ways unless profiling demands it.

## Checklist (before finishing)

- [ ] No intentional logic or copy changes; only file boundaries and imports moved
- [ ] All previous props/state/effects still owned by the same conceptual owner (or clearly moved with identical behavior)
- [ ] No new dependencies unless required for the split (usually none)
- [ ] Imports resolve; no duplicate definitions; default vs named exports consistent with the codebase
- [ ] Large parents: one vertical slice extracted, not a full-file rewrite in one PR unless requested

## IronTrack note

When splitting very large roots (e.g. monolithic `App.jsx`), follow project guidance: **identify the section to modify**, extract that slice into `components/` or `hooks/`, and leave unrelated regions untouched.
