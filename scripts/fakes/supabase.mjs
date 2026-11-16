// An in-memory stand-in for the Supabase client, for scripts/check-server-family.mjs and
// scripts/check-sync.mjs. It has just enough of the query builder and the storage API for
// src/data/family-store.ts, src/data/attempt-sync.ts and src/data/insights-store.ts, and deletes the
// way the schema's foreign keys do: a person takes their cards and card records, and a card its
// schedule and attempts. supabase/tests/rls.test.mjs checks those rules in the real schema.
//
// Card records behave as the real table does for the app: a plain insert of a batch, all or nothing,
// a record already there refused as a duplicate (23505), and one about someone deleted refused by the
// foreign key (23503). The server sets uploaded_at, and sends times the way Postgres writes them.

export const server = {
  tables: { people: [], cards: [], daily_goal: [], profiles: [], card_schedule: [], attempts: [], sessions: [], attempt_records: [] },
  /** Paths in the photo bucket. */
  objects: [],
  /** Every call, in order. */
  log: [],
  /** Makes the storage API refuse to delete. */
  failRemove: false,
  /** No connection: every call fails the way supabase-js reports a network error. */
  offline: false,
  /** The server stores card records, then its reply never arrives: the app was closed meanwhile. */
  hang: false,
  /** The server stores card records, then its reply is lost to a dropped connection. */
  loseReply: false,
  /** Answers a card record with an error code of the server's own, or null to take it. */
  refuse: null,
  /** Busy: card record uploads fail the way a server error does, with nothing stored. */
  busy: false,
  /** Called with each upload of card records as it arrives, before anything else happens to it. */
  onInsert: null,
  /** Answers a read with an error of the server's own, from (table, [from, to]), or null to answer it. */
  failSelect: null,
};

const NETWORK_ERROR = { message: 'TypeError: Network request failed', details: '', hint: '', code: '' };
const KEYS = { card_schedule: ['card_id', 'person_user_id'], daily_goal: ['caregiver_id'] };
const keyOf = (table, row) => (KEYS[table] ?? ['id']).map((column) => row[column]).join('|');

/** A time as Postgres writes it in JSON: "+00:00", and no trailing zeros in the fraction. */
export function pgTime(iso) {
  const [whole, fraction = ''] = new Date(iso).toISOString().slice(0, -1).split('.');
  const digits = fraction.replace(/0+$/, '');
  return `${whole}${digits ? `.${digits}` : ''}+00:00`;
}

let lastUploaded = 0;
const uploadedAt = () => {
  lastUploaded = Math.max(Date.now(), lastUploaded + 1);
  return new Date(lastUploaded).toISOString();
};

function removeRows(table, match) {
  const removed = server.tables[table].filter(match);
  server.tables[table] = server.tables[table].filter((row) => !match(row));
  const ids = new Set(removed.map((row) => row.id));
  if (table === 'people') {
    removeRows('cards', (row) => ids.has(row.person_id));
    removeRows('attempt_records', (row) => ids.has(row.person_id));
  }
  if (table === 'cards') {
    removeRows('card_schedule', (row) => ids.has(row.card_id));
    removeRows('attempts', (row) => ids.has(row.card_id));
  }
}

/** A batch of card records, as the real table takes it: every row or none. */
function insertRecords(rows) {
  const table = server.tables.attempt_records;
  const ids = new Set();
  for (const row of rows) {
    if (table.some((existing) => existing.id === row.id) || ids.has(row.id)) return { code: '23505', message: 'duplicate key value violates unique constraint "attempt_records_pkey"' };
    ids.add(row.id);
    if (!server.tables.people.some((person) => person.id === row.person_id && person.caregiver_id === row.caregiver_id)) {
      return { code: '23503', message: 'insert or update on table "attempt_records" violates foreign key constraint' };
    }
    const refused = server.refuse?.(row);
    if (refused) return { code: refused, message: 'new row for relation "attempt_records" violates check constraint' };
  }
  for (const row of rows) table.push({ ...structuredClone(row), uploaded_at: uploadedAt() });
  return null;
}

/** A card record as the server sends it back: its times written the way Postgres writes them. */
const recordOut = (row) => ({ ...row, shown_at: pgTime(row.shown_at), selected_at: row.selected_at.map(pgTime), uploaded_at: pgTime(row.uploaded_at) });

class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orders = [];
    /** The filters, orders and range asked for, in words, for the log. */
    this.calls = [];
    this.action = 'select';
    this.one = false;
  }
  select() {
    return this;
  }
  order(column, { ascending = true } = {}) {
    this.calls.push(`order ${column}`);
    this.orders.push({ column, ascending });
    return this;
  }
  eq(column, value) {
    this.calls.push(`eq ${column}`);
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column, values) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  gte(column, value) {
    this.calls.push(`gte ${column}`);
    this.filters.push((row) => new Date(row[column]) >= new Date(value) || (!isTime(value) && row[column] >= value));
    return this;
  }
  gt(column, value) {
    this.calls.push(`gt ${column}`);
    this.filters.push((row) => new Date(row[column]) > new Date(value) || (!isTime(value) && row[column] > value));
    return this;
  }
  range(from, to) {
    this.calls.push(`range ${from}-${to}`);
    this.window = [from, to];
    return this;
  }
  maybeSingle() {
    this.one = true;
    return this;
  }
  update(values) {
    this.action = 'update';
    this.values = values;
    return this;
  }
  delete() {
    this.action = 'delete';
    return this;
  }
  insert(rows) {
    this.action = 'insert';
    this.values = rows;
    return this;
  }
  upsert(rows) {
    this.action = 'upsert';
    this.values = rows;
    return this;
  }
  then(resolve, reject) {
    if (this.table === 'attempt_records' && this.action === 'insert' && !server.offline && server.hang) {
      server.log.push({ table: this.table, action: this.action, values: this.values });
      server.onInsert?.([this.values].flat());
      insertRecords([this.values].flat());
      return new Promise(() => {});
    }
    return Promise.resolve()
      .then(() => this.run())
      .then(resolve, reject);
  }
  run() {
    const rows = server.tables[this.table];
    const match = (row) => this.filters.every((filter) => filter(row));
    const entry = { table: this.table, action: this.action, values: this.values, calls: this.calls };
    server.log.push(entry);
    if (server.offline) return { data: null, error: NETWORK_ERROR, status: 0 };
    if (this.table === 'attempt_records' && this.action === 'insert') {
      server.onInsert?.([this.values].flat());
      if (server.busy) return { data: null, error: { message: 'Service Unavailable', code: 'PGRST000' }, status: 503 };
      const error = insertRecords([this.values].flat());
      if (!error && server.loseReply) return { data: null, error: NETWORK_ERROR, status: 0 };
      return { data: null, error, status: error ? 409 : 201 };
    }
    if (this.action === 'select') {
      const failed = server.failSelect?.(this.table, this.window);
      if (failed) return { data: null, error: failed, status: 500 };
      let data = rows.filter(match).map((row) => structuredClone(row));
      if (this.orders.length) {
        data.sort((a, b) => {
          for (const { column, ascending } of this.orders) {
            const order = String(a[column]).localeCompare(String(b[column]));
            if (order) return ascending ? order : -order;
          }
          return 0;
        });
      }
      if (this.window) data = data.slice(this.window[0], this.window[1] + 1);
      entry.rows = data.length;
      if (this.table === 'attempt_records') data = data.map(recordOut);
      return { data: this.one ? (data[0] ?? null) : data, error: null };
    }
    if (this.action === 'update') {
      for (const row of rows.filter(match)) Object.assign(row, structuredClone(this.values));
      return { data: null, error: null };
    }
    if (this.action === 'delete') {
      removeRows(this.table, match);
      return { data: null, error: null };
    }
    for (const row of [this.values].flat()) {
      const at = rows.findIndex((existing) => keyOf(this.table, existing) === keyOf(this.table, row));
      if (at >= 0 && this.action === 'insert') return { data: null, error: { message: 'duplicate key' } };
      if (at >= 0) rows[at] = { ...rows[at], ...structuredClone(row) };
      else rows.push(structuredClone(row));
    }
    return { data: null, error: null };
  }
}

const isTime = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value);

export const supabase = {
  from: (table) => new Query(table),
  storage: {
    from: () => ({
      async list(folder, { limit = 100 } = {}) {
        server.log.push({ storage: 'list', folder });
        const inFolder = server.objects.filter((path) => path.startsWith(`${folder}/`));
        return { data: inFolder.slice(0, limit).map((path) => ({ name: path.slice(folder.length + 1) })), error: null };
      },
      async createSignedUrls(paths) {
        server.log.push({ storage: 'sign', paths });
        if (server.offline) return { data: null, error: NETWORK_ERROR };
        return { data: paths.map((path) => ({ path, signedUrl: server.objects.includes(path) ? `https://signed.invalid/${path}` : null, error: null })), error: null };
      },
      async remove(paths) {
        server.log.push({ storage: 'remove', paths });
        if (server.failRemove) return { data: null, error: { message: 'storage is unavailable' } };
        server.objects = server.objects.filter((path) => !paths.includes(path));
        return { data: paths.map((name) => ({ name })), error: null };
      },
    }),
  },
};
