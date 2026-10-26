# BOM — Implementation review (23–26 October 2026)

## Changes completed during review

- Added project BOM navigation, machine-model navigation, quote-line BOM linking and internal
  per-line/total estimates. Editing and print-width updates preserve the links; reusable quote
  templates omit project-specific BOM links.
- Completed allocation batches, own-draft FIFO suggestions, direct-cost editing, variance tables
  and cost-sheet Excel exports. Fixed the cost dialog initialization race caught by E2E.
- Serialized BOM draft edits and approval; rechecked state after acquiring the row lock.
- Serialized allocation edits, cancellation, confirmation and attached-cost updates; rechecked
  invoice dates at confirmation and treated invoice dates as complete calendar days.
- Required project visibility plus edit permission for quote cost estimates, and material-view
  permission when copying machine models. Added API tests for unauthenticated routes and STAFF scope.
- Corrected contract source VAT, estimate version selection and zero actual costs in model saving;
  guarded unsupported actual subassembly saving instead of returning misleading estimates.
- Made Playwright results use the system temporary directory to avoid exFAT `ENOTEMPTY` failures.

## Push blocker retained by user decision

### Shared stock lot loses attribution across BOM lines

`ProjectMaterialAllocationItem` currently has `@@unique([allocationId, stockLotId])`.
`suggestFifo` therefore merges a lot serving several lines and returns a transient `breakdown`.
The allocation DTO stores only a single `bomLineId`; that breakdown is lost on save.

Reproduction: two lines need the same material, quantities 3 and 2. One lot can provide 5.
The first suggestion merges 5 units into an item linked to line 1. After confirmation,
the next suggestion sees line 2 as still needing 2 units. Actual cost reporting also attributes
all 5 units to line 1.

The user explicitly chose **keep the schema and record this as a push blocker** on 23 October 2026.
The following proposed change is deferred:

1. Replace the unique index with `@@unique([allocationId, stockLotId, bomLineId])` in a new migration;
   retain an ordinary index on `(allocationId, stockLotId)` if required by query plans.
2. Return and persist one allocation item per lot and BOM line. Reject duplicate pairs in the service,
   including duplicates with a null line, and validate the aggregate requested quantity per lot.
3. Keep confirmations atomic; test two lines sharing one lot across save, confirmation, repeated
   suggestions and cost reporting. Do not rewrite previous migrations or invent historical splits.

No schema or migration has been modified. Do not push this feature as fully compliant with the FIFO
and per-line actual-cost requirements until this blocker is resolved in an authorized follow-up.

## Pre-existing migration drift

The required `prisma migrate diff` against a fresh QA shadow database reports:

- `EmailMessage.draftId`: Prisma declares a normal unique index; the historical migration creates
  a partial unique index with `WHERE "draftId" IS NOT NULL`.
- `Quote.acceptedItemIds`: the migration supplies `DEFAULT ARRAY[]::TEXT[]`; the Prisma field has
  no `@default([])`.

There is no BOM table drift in that comparison. Normalizing these historical differences requires
a separate approved schema/migration change. PostgreSQL's regular unique index already permits
multiple NULL values, so the partial index is unnecessary for that behavior.

## Contract VAT assumption

Revenue excludes VAT using source quote rates on contract items, falling back to the accepted quote.
A manually entered contract with no quote has no tax-rate field in the approved schema; its fallback
rate remains zero. Such contracts need an explicit VAT policy or data-model decision before their
reported revenue can be guaranteed to be before VAT.

## Actual models containing subassemblies

`saveAsModel(source="ACTUAL")` currently updates actual quantities and average unit costs only for
ordinary lines. A line with `childBomId` retains its approved child model and therefore its estimated
cost. Actual subassembly costs are not reconstructed into a new model. The service now rejects
ACTUAL saving when a subassembly has recorded actuals, with a Vietnamese explanation, instead of
silently labeling estimates as actual costs. Full ACTUAL support for such subassemblies remains open.

## Validation

Final full run on 26 October 2026: `npm run qa:prepush -- --keep` exited successfully.

| Check | Result |
|---|---|
| Git object integrity | Pass |
| Static UI checks | 0 errors, 0 warnings after AppleDouble cleanup |
| Frontend/backend TypeScript, frontend lint | Pass |
| Backend unit tests | 57 suites, 284 tests passed |
| Frontend unit tests | 10 files, 36 tests passed |
| Production Docker builds | Backend and frontend passed |
| Full Playwright suite | 52/52 passed |
| Focused BOM/security/finance coverage within that suite | 7/7 passed |
| Schema/migration comparison | Exit 2: the two pre-existing differences listed above; no BOM drift |
| Visual checks at 1440 × 900 | Five pages inspected; no page overflow or JavaScript errors |

The finance scenario covers legacy allocations, cancellation, own-draft reservations, direct-cost
CRUD and invoice-date rejection, confirmed-cost immutability, Excel contents, multiple batches and
gross margins of 77% then 73%. BOM coverage includes draft editing, approval locking, new versions,
Excel mapping/append/replace/export, models, quote estimates and HTML/PDF isolation.

Visual inspection covered the BOM editor, project finance, models, quote detail and material kinds.
The finance cards below the first viewport were additionally checked through DOM geometry and values.
A final wording cleanup on quote detail passed TypeScript, lint and static checks after the full run.
Confirmed inventory/contract history can prevent API fixture deletion; the isolated QA volumes are
removed during final teardown, including the remaining visual fixtures.

Local evidence (ignored by Git): `playwright-report/bom-full-qa-20261026.log`,
`playwright-report/bom-migration-diff-20261026.log`, and `playwright-report/bom-visual/`.

## Release decision

No push was performed. The generic success message printed by the QA script does not clear the
documented shared-lot blocker or the open ACTUAL/VAT limitations. Keep this feature blocked for push
as requested. After an authorized follow-up resolves those items and reruns QA, the normal command
would be `git push origin main`.
