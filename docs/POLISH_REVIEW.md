# Post-BOM polish review — 26 October 2026

## Scope and authorization

- Baseline: `55d1738`, confirmed equal to `origin/main` before implementation.
- Plan: `docs/POLISH_AGENT_PROMPTS.md`; step 1 runs first, then steps 2 and 3 may run concurrently.
- The user explicitly requested implementation now and stopping before push. No push is authorized
  for this round, even though the original plan's last row mentions pushing.
- Preserve the existing BOM schema, previously accepted BOM limitations, and the VAT correction
  already present in the baseline. Do not add dependencies or change `components/ui/`.

## Implementation and validation

Results are recorded here after the corresponding checks finish.

## Review notes

- The old `limit: 100` in `useProjectKanban` does not limit server results: the backend's Kanban
  branch already loads all matching projects. Remove redundant pagination arguments without adding
  a new cap or changing the backend Kanban behavior.
- The old `limit: 200` in project import is a customer lookup, rather than a selector. Load that
  lookup in valid API pages only while importing; preserve CSV matching behavior.
- Forms using shadcn `FormLabel`/`FormControl` must keep label associations correct when explicit
  `customerId` and `projectId` input IDs replace generated control IDs.
- `auth/logout` intentionally works through its refresh cookie, including when the access token
  has expired. The new guard check must not accidentally require a valid access token for logout;
  use an explicit public annotation for that existing behavior instead of weakening the checker.
