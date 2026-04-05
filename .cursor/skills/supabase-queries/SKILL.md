---
name: supabase-queries
description: >-
  Writes and refactors Supabase queries safely and efficiently: preserve schema
  and app data rules, minimize columns and rows fetched, avoid N+1 patterns,
  and match existing client/service patterns. Use when adding or changing
  Supabase queries, RLS-related reads, filters, pagination, or when the user
  mentions Supabase, PostgREST, select/from, or database fetches in this
  project.
---

# Supabase queries (IronTrack)

## Before changing anything

1. **Locate existing usage** — Search for `supabase`, `.from(`, and any `services/` modules. Prefer extending the same client, helpers, and naming as the codebase already uses.
2. **Do not widen scope** — Keep edits limited to the query or call sites required for the task; avoid unrelated refactors.
3. **Respect domain invariants** (this app) — Progress must stay tied to routine/week structure; PRs must not be overwritten casually; do not drop `week` or other fields that sync progress with routines unless the task explicitly requires a migration-wide change.

## Query design

- **Select only what the UI or logic needs** — Use explicit column lists when the table is wide or has large JSON/text fields. Avoid `select('*')` unless the consumer truly needs every column or the table is tiny and already established that way.
- **Filter on the server** — Push `.eq()`, `.in()`, ranges, and text filters into the query instead of fetching large sets and filtering in JS.
- **Paginate or cap** — Use `.range()`, `.limit()`, or keyset-style filters for lists that can grow. Do not load unbounded history “just in case.”
- **Prefer one round-trip** — If the UI needs related rows, use a single query with appropriate filters or foreign-key relationships (and documented select shapes) rather than sequential per-id queries unless batching is already a project pattern.
- **Sort only when needed** — Order in the query when the user sees ordered data; avoid redundant sorts in JS after a DB sort.

## Safety and consistency

- **Match existing error handling** — Reuse how the app already surfaces or logs Supabase errors (try/catch, return shapes, toasts).
- **Auth and RLS** — Do not bypass RLS with service-role keys in client code. If a query “returns nothing,” consider session and policies before weakening filters.
- **Migrations and types** — If the task implies schema changes, separate SQL migrations from query changes; do not assume columns exist without checking migrations or types.
- **No speculative queries** — Do not add new tables, views, or RPCs unless the user or task requires them.

## Checklist (quick)

- [ ] Smallest `select` that satisfies the feature
- [ ] Filters and limits applied in Supabase, not only in memory
- [ ] Same client/module patterns as the rest of the repo
- [ ] Domain rules (routine / week / PRs) still hold for reads and writes touched by the change
