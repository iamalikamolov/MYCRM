// Password lock + encryption at rest for the dashboard data in localStorage.
//
// - The password is never stored. A key is derived from it with PBKDF2-SHA256
//   (600k iterations, random 16-byte salt) and used for AES-256-GCM.
// - All dashboard data is stored encrypted. Without the password it cannot be read,
//   so "forgot password" means starting over with fresh data.
// - Everything is kept in ONE localStorage entry, so changing the password
//   (re-encrypting) is a single atomic write.

import type { StateStorage } from "zustand/middleware";

const VAULT_KEY = "acq:vault:v1";
/** Where the app stored plain (unencrypted) data before the lock existed. */
export const LEGACY_PLAIN_KEY = "acquisition-dashboard:v1";
const ITERATIONS = 600_000;
const CHECK_TEXT = "acq-vault-ok";

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

let currentKey: CryptoKey | null = null;

// ─── Encoding helpers ────────────────────────────────────────────────────────
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
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
async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable: the raw key can't be read out of the browser
    ["encrypt", "decrypt"],
  );
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

// ─── Vault file ──────────────────────────────────────────────────────────────
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

export function hasPassword(): boolean {
  return readVault() !== null;
}

export function isUnlocked(): boolean {
  return currentKey !== null;
}

export function getAutoLockMin(): number {
  return readVault()?.autoLockMin ?? 15;
}

export function setAutoLockMin(min: number): void {
  const v = readVault();
  if (v) writeVault({ ...v, autoLockMin: min });
}

export const PASSWORD_MIN = 8;

/** First run: create the password. Existing plain data (from before the lock) is encrypted and the plain copy removed. */
export async function setupPassword(password: string): Promise<void> {
  if (password.length < PASSWORD_MIN) throw new Error("short");
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, ITERATIONS);
  const legacy = localStorage.getItem(LEGACY_PLAIN_KEY);
  writeVault({
    v: 1,
    salt: toB64(salt),
    iter: ITERATIONS,
    check: await encrypt(key, CHECK_TEXT),
    data: legacy ? await encrypt(key, legacy) : null,
    autoLockMin: 15,
  });
  if (legacy) localStorage.removeItem(LEGACY_PLAIN_KEY);
  currentKey = key;
}

async function keyFor(vault: VaultFile, password: string): Promise<CryptoKey | null> {
  const key = await deriveKey(password, fromB64(vault.salt), vault.iter);
  try {
    return (await decrypt(key, vault.check)) === CHECK_TEXT ? key : null;
  } catch {
    return null; // wrong password → AES-GCM authentication fails
  }
}

/** Returns true if the password is correct. */
export async function unlock(password: string): Promise<boolean> {
  const vault = readVault();
  if (!vault) return false;
  const key = await keyFor(vault, password);
  if (key) currentKey = key;
  return key !== null;
}

export function lock(): void {
  currentKey = null;
}

/** Re-encrypts all data with a key from the new password. Returns false if the current password is wrong. */
export async function changePassword(current: string, next: string): Promise<boolean> {
  if (next.length < PASSWORD_MIN) throw new Error("short");
  const vault = readVault();
  if (!vault) return false;
  const oldKey = await keyFor(vault, current);
  if (!oldKey) return false;
  await writeQueue; // let any pending save finish first
  const latest = readVault() ?? vault;
  const plain = latest.data ? await decrypt(oldKey, latest.data) : null;
  const salt = randomBytes(16);
  const newKey = await deriveKey(next, salt, ITERATIONS);
  writeVault({
    ...latest,
    salt: toB64(salt),
    iter: ITERATIONS,
    check: await encrypt(newKey, CHECK_TEXT),
    data: plain === null ? null : await encrypt(newKey, plain),
  });
  currentKey = newKey;
  return true;
}

/** "Forgot password": the data can't be decrypted without it, so everything is erased. */
export function wipeEverything(): void {
  localStorage.removeItem(VAULT_KEY);
  localStorage.removeItem(LEGACY_PLAIN_KEY);
  currentKey = null;
}

// ─── Zustand storage adapter ─────────────────────────────────────────────────
// Saves are chained so an older state can never finish writing after a newer one.
let writeQueue: Promise<void> = Promise.resolve();

export const encryptedStorage: StateStorage = {
  async getItem() {
    const vault = readVault();
    if (!currentKey || !vault?.data) return null;
    try {
      return await decrypt(currentKey, vault.data);
    } catch {
      return null;
    }
  },
  setItem(_name, value) {
    const key = currentKey;
    if (!key) return; // locked: never write
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
    const vault = readVault();
    if (vault) writeVault({ ...vault, data: null });
  },
};
