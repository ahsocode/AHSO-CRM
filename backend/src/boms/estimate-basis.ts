type VersionedBom = { id: string; sourceBomId: string | null; version: number; status: string };

/** Choose an approved version (or the newest draft) independently for each project BOM. */
export function selectEstimateBoms<T extends VersionedBom>(boms: T[]): T[] {
  const byId = new Map(boms.map((bom) => [bom.id, bom]));
  const families = new Map<string, T[]>();
  for (const bom of boms) {
    let root: VersionedBom = bom;
    const seen = new Set([root.id]);
    while (root.sourceBomId) {
      const parent = byId.get(root.sourceBomId);
      // A copied BOM starts at v1 and is a separate machine, even in the same project.
      if (!parent || root.version <= parent.version || seen.has(parent.id)) break;
      seen.add(parent.id);
      root = parent;
    }
    const family = families.get(root.id) ?? [];
    family.push(bom);
    families.set(root.id, family);
  }
  return [...families.values()].flatMap((family) => {
    const approved = family.filter((bom) => bom.status === "APPROVED");
    const candidates = approved.length ? approved : family.filter((bom) => bom.status === "DRAFT");
    return candidates.sort((a, b) => b.version - a.version).slice(0, 1);
  });
}
