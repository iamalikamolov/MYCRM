import "server-only";
import { neon } from "@neondatabase/serverless";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * One encrypted vault per deployment (single owner).
 * The server only ever sees ciphertext + a SHA-256 of the client's auth token:
 * the password and the AES key never leave the browser.
 */
export interface Account {
  salt: string;
  iter: number;
  /** AES-GCM encryption of a known string — lets the client verify the key. */
  checkIv: string;
  checkCt: string;
  /** sha256(authToken) — authToken is derived from the password in the browser. */
  authHash: string;
  dataIv: string | null;
  dataCt: string | null;
  version: number;
  /** Bumped on password change / "sign out everywhere": old session cookies stop working. */
  sessionVersion: number;
  updatedAt: string;
}

export interface Store {
  get(): Promise<Account | null>;
  /** Creates the account only if none exists. Returns false if one already does. */
  create(a: Omit<Account, "version" | "sessionVersion" | "updatedAt">): Promise<boolean>;
  /** Optimistic update: applies only if the stored version still equals `expected`. */
  update(expected: number, patch: Partial<Omit<Account, "version" | "updatedAt">>): Promise<{ ok: true; version: number } | { ok: false }>;
  remove(): Promise<void>;
  /** Login attempts for rate limiting (IP stored only as a hash). */
  recordAttempt(ipHash: string, ok: boolean): Promise<void>;
  failuresSince(ipHash: string | null, sinceMs: number): Promise<{ count: number; oldest: number | null }>;
}

// ─── Neon (production) ───────────────────────────────────────────────────────
type Row = {
  salt: string;
  iter: number;
  check_iv: string;
  check_ct: string;
  auth_hash: string;
  data_iv: string | null;
  data_ct: string | null;
  version: number;
  session_version: number;
  updated_at: string | Date;
};

function neonStore(url: string): Store {
  const sql = neon(url);
  let ready: Promise<void> | null = null;
  const init = () =>
    (ready ??= (async () => {
      await sql`create table if not exists crm_vault (
        id int primary key default 1 check (id = 1),
        salt text not null, iter int not null,
        check_iv text not null, check_ct text not null,
        auth_hash text not null,
        data_iv text, data_ct text,
        version int not null default 1,
        session_version int not null default 1,
        updated_at timestamptz not null default now()
      )`;
      await sql`create table if not exists crm_login_attempts (
        ip_hash text not null, ok boolean not null, at timestamptz not null default now()
      )`;
      await sql`create index if not exists crm_login_attempts_at on crm_login_attempts (at)`;
    })().catch((e) => {
      ready = null;
      throw e;
    }));

  const toAccount = (r: Row): Account => ({
    salt: r.salt,
    iter: r.iter,
    checkIv: r.check_iv,
    checkCt: r.check_ct,
    authHash: r.auth_hash,
    dataIv: r.data_iv,
    dataCt: r.data_ct,
    version: r.version,
    sessionVersion: r.session_version,
    updatedAt: new Date(r.updated_at).toISOString(),
  });

  return {
    async get() {
      await init();
      const rows = (await sql`select * from crm_vault where id = 1`) as Row[];
      return rows[0] ? toAccount(rows[0]) : null;
    },
    async create(a) {
      await init();
      const rows = await sql`insert into crm_vault (id, salt, iter, check_iv, check_ct, auth_hash, data_iv, data_ct)
        values (1, ${a.salt}, ${a.iter}, ${a.checkIv}, ${a.checkCt}, ${a.authHash}, ${a.dataIv}, ${a.dataCt})
        on conflict (id) do nothing returning id`;
      return rows.length === 1;
    },
    async update(expected, p) {
      await init();
      const cur = await this.get();
      if (!cur || cur.version !== expected) return { ok: false };
      const n = { ...cur, ...p };
      const rows = (await sql`update crm_vault set
          salt = ${n.salt}, iter = ${n.iter}, check_iv = ${n.checkIv}, check_ct = ${n.checkCt},
          auth_hash = ${n.authHash}, data_iv = ${n.dataIv}, data_ct = ${n.dataCt},
          session_version = ${n.sessionVersion}, version = version + 1, updated_at = now()
        where id = 1 and version = ${expected} returning version`) as { version: number }[];
      return rows[0] ? { ok: true, version: rows[0].version } : { ok: false };
    },
    async remove() {
      await init();
      await sql`delete from crm_vault where id = 1`;
    },
    async recordAttempt(ipHash, ok) {
      await init();
      await sql`insert into crm_login_attempts (ip_hash, ok) values (${ipHash}, ${ok})`;
      await sql`delete from crm_login_attempts where at < now() - interval '2 days'`;
    },
    async failuresSince(ipHash, sinceMs) {
      await init();
      const since = new Date(sinceMs).toISOString();
      const rows = (
        ipHash
          ? await sql`select count(*)::int as c, min(at) as o from crm_login_attempts where ok = false and at > ${since} and ip_hash = ${ipHash}`
          : await sql`select count(*)::int as c, min(at) as o from crm_login_attempts where ok = false and at > ${since}`
      ) as { c: number; o: string | null }[];
      const r = rows[0];
      return { count: r?.c ?? 0, oldest: r?.o ? new Date(r.o).getTime() : null };
    },
  };
}

// ─── File store (local development / testing only) ───────────────────────────
function fileStore(file: string): Store {
  type Data = { account: Account | null; attempts: { ipHash: string; ok: boolean; at: number }[] };
  let queue: Promise<unknown> = Promise.resolve();
  const read = async (): Promise<Data> => {
    try {
      return JSON.parse(await readFile(file, "utf8")) as Data;
    } catch {
      return { account: null, attempts: [] };
    }
  };
  const write = async (d: Data) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file + ".tmp", JSON.stringify(d));
    await rename(file + ".tmp", file);
  };
  // Serialise read-modify-write cycles.
  const tx = <T,>(fn: (d: Data) => Promise<T> | T): Promise<T> => {
    const run = queue.then(async () => {
      const d = await read();
      const out = await fn(d);
      await write(d);
      return out;
    });
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    get: async () => (await read()).account,
    create: (a) =>
      tx((d) => {
        if (d.account) return false;
        d.account = { ...a, version: 1, sessionVersion: 1, updatedAt: new Date().toISOString() };
        return true;
      }),
    update: (expected, p) =>
      tx((d) => {
        if (!d.account || d.account.version !== expected) return { ok: false as const };
        d.account = { ...d.account, ...p, version: expected + 1, updatedAt: new Date().toISOString() };
        return { ok: true as const, version: expected + 1 };
      }),
    remove: () =>
      tx((d) => {
        d.account = null;
      }),
    recordAttempt: (ipHash, ok) =>
      tx((d) => {
        const cutoff = Date.now() - 2 * 86_400_000;
        d.attempts = [...d.attempts.filter((x) => x.at > cutoff), { ipHash, ok, at: Date.now() }];
      }),
    failuresSince: async (ipHash, sinceMs) => {
      const list = (await read()).attempts.filter((x) => !x.ok && x.at > sinceMs && (!ipHash || x.ipHash === ipHash));
      return { count: list.length, oldest: list.length ? Math.min(...list.map((x) => x.at)) : null };
    },
  };
}

let cached: Store | null | undefined;

/** null = cloud sync is not configured (the app runs in local-only mode). */
export function getStore(): Store | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL;
  if (url) cached = neonStore(url);
  else if (process.env.CLOUD_DEV_FILE) cached = fileStore(path.resolve(process.env.CLOUD_DEV_FILE));
  else cached = null;
  return cached;
}
