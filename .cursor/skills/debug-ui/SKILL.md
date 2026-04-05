---
name: debug-ui
description: >-
  Diagnoses and fixes UI issues: broken scroll, overlapping elements, layout
  collapse, and stacking/z-index bugs in web UIs (React/CSS). Improves clarity
  and polish within the existing design system without redesigning screens. Use
  when the user reports scroll stuck or jumping, content hidden under headers or
  modals, layout overflow, flex/grid bugs, z-index fights, or asks to fix
  interface glitches while keeping the same look and structure.
---

# Debug UI (layout, scroll, overlap, polish)

## Non-negotiables

- **Preserve the base design** — Same visual language: palette, typography scale, spacing rhythm, and component shapes. Fix behavior and broken CSS; do not restyle for taste unless the user asks.
- **Minimal, targeted changes** — Prefer one clear root-cause fix over piling on `z-index: 9999` or arbitrary `!important`.
- **Match the stack** — Use whatever the file already uses (Tailwind, CSS modules, styled-components, inline styles). Do not introduce a new styling approach for a small fix.

## Workflow

1. **Reproduce** — Note route, viewport width, scroll container (window vs inner div), and any modal/drawer open.
2. **Identify the faulty layer** — Which element clips, overlaps, or grows wrong? Trace **parent chain** for `overflow`, `position`, `height`, `flex`, `transform`.
3. **Fix the cause** — Adjust containment, flex/grid constraints, or stacking context; avoid unrelated refactors.
4. **Verify** — Keyboard/focus if interactive; narrow + wide viewport if layout is responsive.

## Scroll problems

| Symptom | Common causes | Direction |
|--------|----------------|-----------|
| Page won’t scroll | `overflow: hidden` on `html`/`body` or a full-height wrapper | Remove or scope overflow to the intended panel only |
| Inner area doesn’t scroll | Missing `overflow-y: auto` / `min-height: 0` on flex child | Flex item needs `min-height: 0` (or `min-w-0` horizontally) so it can shrink and scroll |
| Double scrollbars | Nested scrollable regions | One primary scroller; inner only if deliberate |
| `100vh` wrong on mobile | Mobile URL bar | Prefer `min-height: 100dvh` / dynamic viewport units where the codebase already allows |
| Fixed header covers content | No padding/margin under fixed region | Add offset equal to header height on scrollable content, or use documented layout shell pattern |

## Overlapping / stacking

- **Stacking contexts** — `transform`, `filter`, `opacity < 1`, `isolation`, and sometimes `will-change` create new contexts; child `z-index` only competes inside that context.
- **Fix** — Raise `z-index` on the correct ancestor, or remove the accidental context creator; align dropdowns/modals with the project’s portal/overlay pattern if one exists.
- **Sticky/fixed** — Check `top`/`left`, parent `overflow: hidden` (can break sticky), and that overlays use the same coordinate system (portal vs in-tree).

## Broken layout

- **Flex** — Children that won’t shrink: `min-width: 0` / `min-height: 0` on the scrolling or truncating child; avoid fixed heights unless the design already uses them.
- **Grid** — Explicit tracks vs `1fr`; watch `minmax(0, 1fr)` when content overflows.
- **Width** — `width: 100%` + horizontal padding: ensure `box-sizing: border-box` (usually global); fix overflow instead of random negative margins.
- **Images/media** — `max-width: 100%`, `height: auto` where assets blow up flex rows.

## Visual polish (no redesign)

- **Within existing tokens** — Slightly adjust spacing, alignment, or contrast using the same variables/classes already in the file.
- **Readability** — Fix illegible text on busy backgrounds using existing overlay or text color utilities, not new brand colors.
- **States** — Restore missing `:focus-visible` / disabled styles only if the rest of the app uses them; keep consistency.

## Checklist (before finishing)

- [ ] Root cause addressed (not only symptom)
- [ ] No change to overall layout intent or brand look unless requested
- [ ] Scroll works on the intended container at relevant viewport sizes
- [ ] Overlays and headers don’t permanently hide interactive content
- [ ] No new global hacks unless the codebase already relies on that pattern

## IronTrack note

Large roots (e.g. monolithic `App.jsx`): **locate the section** that owns the broken layout; change only that subtree’s styles/structure. Do not rewrite unrelated UI.
