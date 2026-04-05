---
name: fitness-features
description: >-
  Designs and implements training-domain features (routines, exercises, sets,
  progression) with clear separation between domain data and UI, coach-minded
  defaults, and student-first UX. Use when building or changing workouts,
  weekly structure, logging sets/reps/load, deloads, PRs, progression rules,
  or any screen/flow where the athlete follows a plan and records sessions
  in IronTrack.
---

# Fitness features (IronTrack)

## Mental model

Think like a **strength coach**, not only like a frontend developer:

- A **routine** is a structured plan over time (weeks → days → exercises).
- **Progression** is intentional: small, trackable steps; clarity beats complexity.
- The **student** should always know *what to do today*, *what they did last time*, and *whether they are improving* without hunting through the UI.

## Domain invariants (do not break)

Align with the app’s training data rules:

- Preserve **routine → week → day → exercise** relationships; do not flatten or orphan entities casually.
- Every **session / progress record** that represents work done must stay tied to the correct **week** (and routine context) so history and “current week” stay truthful.
- **PRs** accumulate; avoid logic that resets or overwrites personal records unless the product explicitly requires a one-off migration or correction.

When persistence or Supabase is involved, also follow [.cursor/skills/supabase-queries/SKILL.md](../supabase-queries/SKILL.md).

## Data vs UI

- **Domain layer** (types, transforms, validation, progression rules): pure, testable, minimal coupling to React.
- **UI layer**: renders state, collects input, shows coach-friendly copy; does not silently “fix” bad data—validate at boundaries.
- **Single source of truth**: routine structure and logged sets both matter; keep them **synchronized** when the user changes plan or logs work—never show progress that contradicts the active routine without an explicit rule (e.g. archived routine).

Prefer **small, explicit** functions: `normalizeSet`, `weekForDate`, `exerciseKey`, rather than giant components that mix fetching, business rules, and layout.

## Coach-minded product choices

- **Defaults**: sensible reps/RPE/rest labels; avoid empty or cryptic fields the athlete must guess.
- **Feedback**: after logging, confirm what was saved (exercise, sets, date/week).
- **Safety & clarity**: distinguish *prescription* (what the plan says) from *performance* (what they did); do not merge them in the data model unless the codebase already does.
- **Progression**: prefer rules the user can understand (“add 2.5 kg when all sets hit target”) over black-box scoring unless the feature spec demands it.

## Student experience

- Reduce taps and cognitive load on **training day**; editing the full program can be secondary.
- Show **context** at the point of logging: last session, target reps/load, optional notes.
- Handle **edge cases** gracefully: missed day, deload week, exercise swap—prefer clear messaging over silent wrong data.
- **Performance**: long exercise lists and history should stay snappy (virtualization, pagination, or existing list patterns—match the codebase).

## Checklist (before shipping a training feature)

- [ ] Routine / week / day / exercise relationships remain valid for reads and writes touched by the change.
- [ ] Logged work keeps correct week (and any other required sync fields).
- [ ] PR and history behavior still matches product rules (no accidental reset).
- [ ] UI copy and labels make sense to someone mid-workout.
- [ ] Prescription vs performance is clear in code and, where relevant, in the UI.

## When scope grows

If a change mainly splits UI from logic in a huge file, consider [.cursor/skills/component-refactor/SKILL.md](../component-refactor/SKILL.md). For render cost in hot paths, consider the user’s `react-optimization` skill if enabled.
