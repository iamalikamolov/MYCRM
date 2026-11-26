// Password lock + end-to-end encryption for the dashboard data.
//
// Two storage modes, same crypto idea:
//  • local — everything lives in this browser's localStorage (no server).
//  • cloud — the server (/api/vault) stores ONLY ciphertext, so phone and computer share
//            the same data. The password never leaves the browser:
//              PBKDF2-SHA256(password, salt, 600k) → 512 bits
//                ├─ first 256 bits  → AES-256-GCM key (encrypts the data)
//                └─ last 256 bits   → auth token (server keeps only its SHA-256)
//            so neither the server nor the database provider can read the data.

import type { StateStorage } from "zustand/middleware";

const VAULT_KEY = "acq:vault:v1";
const AUTOLOCK_KEY = "acq:autolock";
/** Where the app stored plain (unencrypted) data before the lock existed. */
export const LEGACY_PLAIN_KEY = "acquisition-dashboard:v1";
const ITERATIONS = 600_000;
const CHECK_TEXT = "acq-vault-ok";
export const PASSWORD_MIN = 8;

interface Blob {
  iv: string;
  ct: string;
}

interface VaultFile {
  v: 1;
  salt: string;
  iter: number;
  check: Blob;
  data: Blob | null;
  autoLockMin: number;
}

export type Mode = "local" | "cloud";
export type SyncStatus = "idle" | "saving" | "saved" | "offline" | "error";

let mode: Mode = "local";
let cloudExists = false;
let cloudSalt: string | null = null;
let cloudIter = ITERATIONS;

let currentKey: CryptoKey | null = null;
let authToken: string | null = null; // cloud only, memory only
let cloudPlain: string | null = null; // last known plaintext state (cloud)
let cloudVersion = 0;
let dirty = false;

// ─── Encoding helpers ────────────────────────────────────────────────────────
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
}

// ─── Crypto ──────────────────────────────────────────────────────────────────
async function passwordMaterial(password: string) {
  return crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveKey", "deriveBits"]);
}

/** Local-mode key (unchanged format, so existing local vaults keep working). */
async function deriveLocalKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    await passwordMaterial(password),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Cloud-mode: one PBKDF2 run → AES key + independent auth token. */
async function deriveCloud(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, await passwordMaterial(password), 512),
  );
  const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return { key, token: toB64(bits.slice(32)) };
}

async function encrypt(key: CryptoKey, text: string): Promise<Blob> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  return { iv: toB64(iv), ct: toB64(ct) };
}

async function decrypt(key: CryptoKey, blob: Blob): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, key, fromB64(blob.ct));
  return dec.decode(pt);
}

async function checkOk(key: CryptoKey, blob: Blob): Promise<boolean> {
  try {
    return (await decrypt(key, blob)) === CHECK_TEXT;
  } catch {
    return false;
  }
}

// ─── Local vault file ────────────────────────────────────────────────────────
function readVault(): VaultFile | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as VaultFile;
    return v && v.v === 1 && v.salt && v.check ? v : null;
  } catch {
    return null;
  }
}

function writeVault(v: VaultFile): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(v));
}

// ─── Cloud API ───────────────────────────────────────────────────────────────
export class VaultError extends Error {
  constructor(
    public code: "wrong_password" | "rate_limited" | "bad_setup_code" | "network" | "exists" | "conflict" | "unauthorized" | "server",
    public retryAfter = 0,
  ) {
    super(code);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T | null }> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new VaultError("network");
  }
  const body = res.status === 204 ? null : ((await res.json().catch(() => null)) as T | null);
  if (res.status === 429) throw new VaultError("rate_limited", Number((body as { retryAfter?: number } | null)?.retryAfter ?? 60));
  if (res.status >= 500) throw new VaultError("server");
  return { status: res.status, body };
}

type ServerVault = { version: number; checkIv: string; checkCt: string; dataIv: string | null; dataCt: string | null };

// ─── Public API ──────────────────────────────────────────────────────────────
/** Detects cloud mode (server has a database) once at start-up. */
export async function initVault(): Promise<{ mode: Mode; hasPassword: boolean }> {
  try {
    const { body } = await api<{ enabled: boolean; exists?: boolean; salt?: string; iter?: number }>("/api/vault/meta");
    if (body?.enabled) {
      mode = "cloud";
      cloudExists = !!body.exists;
      cloudSalt = body.salt ?? null;
      cloudIter = body.iter ?? ITERATIONS;
      return { mode, hasPassword: cloudExists };
    }
  } catch {
    // No server (static hosting / offline dev) → local mode.
  }
  mode = "local";
  return { mode, hasPassword: readVault() !== null };
}

export const getMode = () => mode;
/** Cloud vault exists but holds no data yet (fresh setup) → the app should save its state once. */
export const needsInitialSave = () => mode === "cloud" && currentKey !== null && cloudPlain === null;
export const isUnlocked = () => currentKey !== null;

export function getAutoLockMin(): number {
  const v = Number(localStorage.getItem(AUTOLOCK_KEY));
  if (localStorage.getItem(AUTOLOCK_KEY) !== null && Number.isFinite(v)) return v;
  return readVault()?.autoLockMin ?? 15;
}

export function setAutoLockMin(min: number): void {
  localStorage.setItem(AUTOLOCK_KEY, String(min));
}

/** First run: create the password (cloud mode also needs the one-time setup code). */
export async function setupPassword(password: string, setupCode = ""): Promise<void> {
  if (password.length < PASSWORD_MIN) throw new Error("short");
  const salt = randomBytes(16);
  if (mode === "local") {
    const key = await deriveLocalKey(password, salt, ITERATIONS);
    const legacy = localStorage.getItem(LEGACY_PLAIN_KEY);
    writeVault({ v: 1, salt: toB64(salt), iter: ITERATIONS, check: await encrypt(key, CHECK_TEXT), data: legacy ? await encrypt(key, legacy) : null, autoLockMin: 15 });
    if (legacy) localStorage.removeItem(LEGACY_PLAIN_KEY);
    currentKey = key;
    return;
  }
  const { key, token } = await deriveCloud(password, salt, ITERATIONS);
  const check = await encrypt(key, CHECK_TEXT);
  const { status, body } = await api<{ version?: number; error?: string }>("/api/vault/setup", {
    method: "POST",
    body: JSON.stringify({ setupCode, salt: toB64(salt), iter: ITERATIONS, checkIv: check.iv, checkCt: check.ct, authToken: token, dataIv: null, dataCt: null }),
  });
  if (status === 403) throw new VaultError("bad_setup_code");
  if (status === 409) throw new VaultError("exists");
  if (status !== 200 || !body?.version) throw new VaultError("server");
  cloudExists = true;
  cloudSalt = toB64(salt);
  cloudIter = ITERATIONS;
  currentKey = key;
  authToken = token;
  cloudVersion = body.version;
  cloudPlain = null;
  dirty = false;
}

async function loginCloud(token: string): Promise<ServerVault | null> {
  const { status, body } = await api<ServerVault>("/api/vault/login", { method: "POST", body: JSON.stringify({ authToken: token }) });
  if (status === 401) return null;
  if (status !== 200 || !body) throw new VaultError("server");
  return body;
}

/** Returns true if the password is correct. Throws VaultError for rate limits / network. */
export async function unlock(password: string): Promise<boolean> {
  if (mode === "local") {
    const vault = readVault();
    if (!vault) return false;
    const key = await deriveLocalKey(password, fromB64(vault.salt), vault.iter);
    if (!(await checkOk(key, vault.check))) return false;
    currentKey = key;
    return true;
  }
  if (!cloudSalt) {
    const r = await initVault();
    if (!r.hasPassword || !cloudSalt) return false;
  }
  const { key, token } = await deriveCloud(password, fromB64(cloudSalt), cloudIter);
  const v = await loginCloud(token);
  if (!v || !(await checkOk(key, { iv: v.checkIv, ct: v.checkCt }))) return false;
  currentKey = key;
  authToken = token;
  cloudVersion = v.version;
  cloudPlain = v.dataIv && v.dataCt ? await decrypt(key, { iv: v.dataIv, ct: v.dataCt }) : null;
  dirty = false;
  return true;
}

export function lock(): void {
  // Send any not-yet-saved change before forgetting the key, then end the server session.
  clearTimeout(pushTimer);
  const pending = mode === "cloud" && dirty ? push() : Promise.resolve();
  currentKey = null;
  authToken = null;
  cloudPlain = null;
  dirty = false;
  stopSync();
  if (mode === "cloud") void pending.finally(() => api("/api/vault/logout", { method: "POST" }).catch(() => undefined));
}

/** Re-encrypts all data with a key from the new password. Returns false if the current password is wrong. */
export async function changePassword(current: string, next: string): Promise<boolean> {
  if (next.length < PASSWORD_MIN) throw new Error("short");
  const salt = randomBytes(16);
  if (mode === "local") {
    const vault = readVault();
    if (!vault) return false;
    const oldKey = await deriveLocalKey(current, fromB64(vault.salt), vault.iter);
    if (!(await checkOk(oldKey, vault.check))) return false;
    await writeQueue;
    const latest = readVault() ?? vault;
    const plain = latest.data ? await decrypt(oldKey, latest.data) : null;
    const newKey = await deriveLocalKey(next, salt, ITERATIONS);
    writeVault({ ...latest, salt: toB64(salt), iter: ITERATIONS, check: await encrypt(newKey, CHECK_TEXT), data: plain === null ? null : await encrypt(newKey, plain) });
    currentKey = newKey;
    return true;
  }
  if (!cloudSalt) return false;
  const old = await deriveCloud(current, fromB64(cloudSalt), cloudIter);
  if (old.token !== authToken) return false;
  await flush();
  const fresh = await deriveCloud(next, salt, ITERATIONS);
  const check = await encrypt(fresh.key, CHECK_TEXT);
  const data = await encrypt(fresh.key, cloudPlain ?? "");
  const { status, body } = await api<{ version?: number }>("/api/vault/password", {
    method: "POST",
    body: JSON.stringify({ version: cloudVersion, salt: toB64(salt), iter: ITERATIONS, checkIv: check.iv, checkCt: check.ct, authToken: fresh.token, dataIv: data.iv, dataCt: data.ct }),
  });
  if (status !== 200 || !body?.version) throw new VaultError(status === 409 ? "conflict" : "server");
  cloudSalt = toB64(salt);
  cloudIter = ITERATIONS;
  currentKey = fresh.key;
  authToken = fresh.token;
  cloudVersion = body.version;
  return true;
}

/** "Forgot password": the data can't be decrypted without it, so everything is erased. */
export async function wipeEverything(setupCode = ""): Promise<void> {
  if (mode === "cloud") {
    const { status } = await api("/api/vault/reset", { method: "POST", body: JSON.stringify({ setupCode }) });
    if (status === 403) throw new VaultError("bad_setup_code");
    if (status !== 200) throw new VaultError("server");
    cloudExists = false;
    cloudSalt = null;
  }
  localStorage.removeItem(VAULT_KEY);
  localStorage.removeItem(LEGACY_PLAIN_KEY);
  currentKey = null;
  authToken = null;
  cloudPlain = null;
}

// ─── Cloud sync ──────────────────────────────────────────────────────────────
const syncListeners = new Set<(s: SyncStatus) => void>();
const remoteListeners = new Set<() => void>();
let syncStatus: SyncStatus = "idle";
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let pushing: Promise<void> | null = null;

function setStatus(s: SyncStatus) {
  syncStatus = s;
  syncListeners.forEach((f) => f(s));
}
export const getSyncStatus = () => syncStatus;
export function onSyncStatus(f: (s: SyncStatus) => void) {
  syncListeners.add(f);
  return () => void syncListeners.delete(f);
}
/** Fires when newer data arrived from another device (the store should rehydrate). */
export function onRemoteChange(f: () => void) {
  remoteListeners.add(f);
  return () => void remoteListeners.delete(f);
}

async function ensureSession<T>(call: () => Promise<{ status: number; body: T | null }>) {
  let r = await call();
  if (r.status === 401 && authToken) {
    // Session cookie expired: log in again silently with the in-memory token.
    if (!(await loginCloud(authToken))) throw new VaultError("unauthorized");
    r = await call();
  }
  return r;
}

async function push(): Promise<void> {
  const key = currentKey;
  if (mode !== "cloud" || !key || !dirty || cloudPlain === null) return;
  setStatus("saving");
  const plain = cloudPlain;
  const data = await encrypt(key, plain);
  try {
    const { status, body } = await ensureSession(() =>
      api<{ version?: number }>("/api/vault", { method: "PUT", body: JSON.stringify({ version: cloudVersion, dataIv: data.iv, dataCt: data.ct }) }),
    );
    if (status === 200 && body?.version) {
      cloudVersion = body.version;
      if (cloudPlain === plain) dirty = false;
      setStatus(dirty ? "saving" : "saved");
      if (dirty) schedulePush();
      return;
    }
    if (status === 409) {
      // Another device saved first: its version wins; reload it.
      dirty = false;
      await pull(true);
      return;
    }
    setStatus("error");
  } catch (e) {
    setStatus(e instanceof VaultError && e.code === "network" ? "offline" : "error");
    schedulePush(5000);
  }
}

function schedulePush(delay = 700) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushing = (pushing ?? Promise.resolve()).then(push).finally(() => {
      pushing = null;
    });
  }, delay);
}

/** Wait for pending saves (before password change / export). */
async function flush() {
  if (dirty) {
    clearTimeout(pushTimer);
    await push();
  }
  await pushing;
}

/** Fetch newer data from the server, if any. */
export async function pull(force = false): Promise<void> {
  const key = currentKey;
  if (mode !== "cloud" || !key || (dirty && !force)) return;
  try {
    const { status, body } = await ensureSession(() => api<ServerVault>(`/api/vault?v=${force ? 0 : cloudVersion}`));
    if (status === 204 || !body) return void (syncStatus !== "saving" && setStatus("saved"));
    if (status !== 200) return;
    if (body.version === cloudVersion && !force) return;
    cloudVersion = body.version;
    cloudPlain = body.dataIv && body.dataCt ? await decrypt(key, { iv: body.dataIv, ct: body.dataCt }) : null;
    dirty = false;
    setStatus("saved");
    remoteListeners.forEach((f) => f());
  } catch (e) {
    if (e instanceof VaultError && e.code === "network") setStatus("offline");
  }
}

function onVisible() {
  if (document.visibilityState === "visible") void pull();
}
function onOnline() {
  if (dirty) schedulePush(0);
  else void pull();
}

/** Starts background sync (poll every 15 s while visible, on focus and when back online). */
export function startSync(): void {
  if (mode !== "cloud") return;
  stopSync();
  pollTimer = setInterval(() => document.visibilityState === "visible" && void pull(), 15_000);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  window.addEventListener("online", onOnline);
  setStatus("saved");
}

/** Stops polling/listeners. Pending saves are NOT cancelled (they still go out). */
export function stopSync(): void {
  clearInterval(pollTimer);
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
    window.removeEventListener("online", onOnline);
  }
  setStatus("idle");
}

// ─── Backup (export / import) ────────────────────────────────────────────────
interface BackupFile {
  format: "mijoz-topish-backup";
  v: 1;
  kind: "local-v1" | "cloud-v1";
  createdAt: string;
  salt: string;
  iter: number;
  check: Blob;
  data: Blob;
}

/** Encrypted backup of the current data (needs the same password to open). */
export async function exportBackup(): Promise<string> {
  const key = currentKey;
  if (!key) throw new VaultError("unauthorized");
  if (mode === "local") {
    await writeQueue;
    const v = readVault();
    if (!v?.data) throw new VaultError("server");
    return JSON.stringify({ format: "mijoz-topish-backup", v: 1, kind: "local-v1", createdAt: new Date().toISOString(), salt: v.salt, iter: v.iter, check: v.check, data: v.data } satisfies BackupFile);
  }
  await flush();
  if (!cloudSalt || cloudPlain === null) throw new VaultError("server");
  return JSON.stringify({
    format: "mijoz-topish-backup",
    v: 1,
    kind: "cloud-v1",
    createdAt: new Date().toISOString(),
    salt: cloudSalt,
    iter: cloudIter,
    check: await encrypt(key, CHECK_TEXT),
    data: await encrypt(key, cloudPlain),
  } satisfies BackupFile);
}

/**
 * Opens a backup with the password it was made with and makes it the current data
 * (re-encrypted with the current key, and synced in cloud mode).
 */
export async function importBackup(fileText: string, password: string): Promise<boolean> {
  if (!currentKey) throw new VaultError("unauthorized");
  let b: BackupFile;
  try {
    b = JSON.parse(fileText) as BackupFile;
    if (b.format !== "mijoz-topish-backup" || !b.salt || !b.check || !b.data) throw new Error("format");
  } catch {
    throw new Error("format");
  }
  const salt = fromB64(b.salt);
  const key = b.kind === "cloud-v1" ? (await deriveCloud(password, salt, b.iter)).key : await deriveLocalKey(password, salt, b.iter);
  if (!(await checkOk(key, b.check))) return false;
  const plain = await decrypt(key, b.data);
  if (mode === "local") {
    const v = readVault();
    if (!v) return false;
    writeVault({ ...v, data: await encrypt(currentKey, plain) });
  } else {
    cloudPlain = plain;
    dirty = true;
    await flush();
  }
  return true;
}

// ─── Zustand storage adapter ─────────────────────────────────────────────────
// Local saves are chained so an older state can never finish writing after a newer one.
let writeQueue: Promise<void> = Promise.resolve();

export const encryptedStorage: StateStorage = {
  async getItem() {
    if (!currentKey) return null;
    if (mode === "cloud") return cloudPlain;
    const vault = readVault();
    if (!vault?.data) return null;
    try {
      return await decrypt(currentKey, vault.data);
    } catch {
      return null;
    }
  },
  setItem(_name, value) {
    const key = currentKey;
    if (!key) return; // locked: never write
    if (mode === "cloud") {
      if (value === cloudPlain) return;
      cloudPlain = value;
      dirty = true;
      schedulePush();
      return;
    }
    writeQueue = writeQueue
      .then(async () => {
        const vault = readVault();
        if (!vault || currentKey !== key) return;
        writeVault({ ...vault, data: await encrypt(key, value) });
      })
      .catch(() => undefined);
    return writeQueue;
  },
  removeItem() {
    if (mode === "cloud") return;
    const vault = readVault();
    if (vault) writeVault({ ...vault, data: null });
  },
};
