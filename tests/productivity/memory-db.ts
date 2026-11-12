// Transactional test double. Database constraints/locks have a separate real-DB suite.
type Row = Record<string, unknown>;
const names = ["user", "productivityPreferences", "productivityHabit", "productivityCategory", "productivityOccurrence", "productivityTask", "productivityEvent", "productivityRequest"] as const;
type Tables = Record<typeof names[number], Row[]>;
interface Model {
  findUnique(input: { where: Row }): Promise<Row | null>;
  findMany(input?: { where?: Row }): Promise<Row[]>;
  upsert(input: { where: Row; create: Row; update: Row }): Promise<Row>;
  create(input: { data: Row }): Promise<Row>;
}
let tables: Tables;
let queue = Promise.resolve();
let sequence = 0;
export let failNextWrite = false;
export function failWrite() { failNextWrite = true; }
export function resetDatabase() { tables = { user: [], productivityPreferences: [], productivityHabit: [], productivityCategory: [], productivityOccurrence: [], productivityTask: [], productivityEvent: [], productivityRequest: [] }; queue = Promise.resolve(); sequence = 0; failNextWrite = false; }
export function rows(name: typeof names[number]) { return tables[name]; }
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => value && typeof value === "object" ? matches(row, value as Row) : row[key] === value);
}
function client(state: Tables) {
  const result = Object.fromEntries(names.map(name => [name, {
    async findUnique({ where }: { where: Row }) { return structuredClone(state[name].find(row => matches(row, where)) || null); },
    async findMany({ where }: { where?: Row } = {}) { return structuredClone(state[name].filter(row => matches(row, where))); },
    async upsert({ where, create, update }: { where: Row; create: Row; update: Row }) {
      if (failNextWrite) { failNextWrite = false; throw new Error("Simulated persistence failure"); }
      let row = state[name].find(row => matches(row, where));
      if (row) Object.assign(row, structuredClone(update));
      else { row = { id: `db-${++sequence}`, ...structuredClone(create) }; state[name].push(row); }
      return structuredClone(row);
    },
    async create({ data }: { data: Row }) {
      if (failNextWrite) { failNextWrite = false; throw new Error("Simulated persistence failure"); }
      const row = { id: `db-${++sequence}`, ...structuredClone(data) }; state[name].push(row); return structuredClone(row);
    },
  }])) as unknown as Record<typeof names[number], Model>;
  return { ...result, async $queryRaw() { return []; } };
}
resetDatabase();
export const memoryPrisma = {
  get user() { return client(tables).user; },
  $transaction<T>(fn: (tx: unknown) => Promise<T>) {
    const task = queue.then(async () => {
      const draft = structuredClone(tables);
      const result = await fn(client(draft)); tables = draft; return result;
    });
    queue = task.then(() => undefined, () => undefined); return task;
  },
};
