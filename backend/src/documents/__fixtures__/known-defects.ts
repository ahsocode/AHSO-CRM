/**
 * Ratchet for audit defects (docs/DOCUMENT_TEMPLATE_AUDIT.md). A test tied to an id listed here
 * runs as `it.failing`: it must keep failing until the defect is fixed, then the id MUST be removed
 * (otherwise the now-passing test turns red). Empty set = every audited defect covered by specs is fixed.
 */
// Step 0 started with E-01, E-02, E-04, E-06a/b, E-11, E-13, E-20 (dup keys, typo) listed here;
// steps 1 and 2 fixed all of them. Add an id (optionally "ID:SCOPE") only for a newly found defect.
export const KNOWN_DEFECTS = new Set<string>([]);

export function ratchet(id: string, scope?: string): jest.It {
  const known =
    KNOWN_DEFECTS.has(id) ||
    (scope !== undefined && KNOWN_DEFECTS.has(`${id}:${scope}`));
  return known ? it.failing : it;
}
