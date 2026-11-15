/** Per-account, in-memory only. Owns promise deduplication and stale data. */
interface Entry<T = unknown> { value?: T; ready: boolean; expires: number; pending?: Promise<T>; invalidated: boolean; tags: Set<string> }
export class ProductivityReadCache {
  private readonly entries = new Map<string, Entry>();
  private revision = 0;
  private generation = 0;
  private readonly tagVersions = new Map<string, number>();
  get version() { return this.revision; }
  stamp(tags: string[]) { return tags.map(tag => `${tag}:${this.tagVersions.get(tag) || 0}`).join("|"); }
  constructor(readonly ownerId: string, private readonly now: () => number = Date.now) {}
  peek<T>(key: string): T | undefined { const entry = this.entries.get(key); return entry?.ready ? entry.value as T : undefined; }
  fresh<T>(key: string): T | undefined { const entry = this.entries.get(key); return entry?.ready && !entry.invalidated && entry.expires > this.now() ? entry.value as T : undefined; }
  seed<T>(key: string, value: T, tags: string[], ttl = 60000) { this.entries.set(key, { value, ready: true, expires: this.now() + ttl, invalidated: false, tags: new Set(tags) }); }
  updateReady(tags: string[], update: (value: unknown, key: string) => { value: unknown; ttl: number } | undefined) {
    const affected = new Set(tags);
    for (const [key, entry] of this.entries) {
      if (!entry.ready || ![...entry.tags].some(tag => affected.has(tag))) continue;
      const next = update(entry.value, key);
      // Replace the entry so a pre-save pending read cannot overwrite the acknowledgement.
      if (next) this.seed(key, next.value, [...entry.tags], next.ttl);
    }
  }
  async read<T>(key: string, load: () => Promise<T>, tags: string[], ttl = 60000): Promise<T> {
    let entry = this.entries.get(key) as Entry<T> | undefined;
    if (entry?.ready && !entry.invalidated && entry.expires > this.now()) return entry.value!;
    if (entry?.pending && !entry.invalidated) return entry.pending;
    entry = { value: entry?.value, ready: entry?.ready || false, expires: 0, invalidated: false, tags: new Set(tags) };
    this.entries.set(key, entry);
    const current = entry, generation = this.generation;
    current.pending = load().then(value => {
      if (generation !== this.generation) throw new Error("The account cache was cleared.");
      // A mutation must not let an older in-flight read repopulate stale data.
      if (current.invalidated || this.entries.get(key) !== current) return this.read(key, load, tags, ttl);
      current.value = value; current.ready = true; current.expires = this.now() + ttl; current.pending = undefined;
      return value;
    }, error => { current.pending = undefined; throw error; });
    return current.pending;
  }
  invalidate(tags: Iterable<string>) { this.revision++; const affected = new Set(tags); for (const tag of affected) this.tagVersions.set(tag, (this.tagVersions.get(tag) || 0) + 1); for (const entry of this.entries.values()) if ([...entry.tags].some(tag => affected.has(tag))) { entry.invalidated = true; entry.expires = 0; } }
  clear() { this.revision++; this.generation++; for (const entry of this.entries.values()) entry.invalidated = true; this.entries.clear(); this.tagVersions.clear(); }
}
