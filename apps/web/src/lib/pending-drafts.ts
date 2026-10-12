/** Per-draft writes prevent unrelated drafts in other tabs from being overwritten. */
export function draftChanges<T extends { log: { id: string } }>(previous: T[], next: T[]): Array<{ id: string; value: string | null }> {
  const before = new Map(previous.map((item) => [item.log.id, JSON.stringify(item)]));
  const after = new Map(next.map((item) => [item.log.id, JSON.stringify(item)]));
  return [
    ...[...after].filter(([id, value]) => before.get(id) !== value).map(([id, value]) => ({ id, value })),
    ...[...before.keys()].filter((id) => !after.has(id)).map((id) => ({ id, value: null })),
  ];
}
