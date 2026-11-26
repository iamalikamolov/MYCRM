import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { type Account, getStore, type Store } from "./store";

const COOKIE = "crm_session";
const SESSION_DAYS = 30;

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("base64url");

/** Constant-time comparison of two strings (hashed first so lengths don't leak). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  return new TextEncoder().encode(s);
}

/** Peppered hash of the client IP — the raw IP is never stored. */
export function ipHash(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  return createHmac("sha256", secret()).update(ip).digest("base64url");
}

/** Blocks cross-site requests to state-changing endpoints (CSRF). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function setSession(res: NextResponse, req: NextRequest, account: Pick<Account, "sessionVersion">) {
  const token = await new SignJWT({ sv: account.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const secure = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.cookies.set(COOKIE, token, { httpOnly: true, secure, sameSite: "strict", path: "/api", maxAge: SESSION_DAYS * 86400 });
  return res;
}

export function clearSession(res: NextResponse) {
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/api", maxAge: 0 });
  return res;
}

/** Returns the account if the request carries a valid, current session cookie. */
export async function authed(req: NextRequest, store: Store): Promise<Account | null> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const account = await store.get();
    return account && payload.sv === account.sessionVersion ? account : null;
  } catch {
    return null;
  }
}

export function requireStore(): Store | NextResponse {
  const store = getStore();
  return store ?? json({ error: "cloud_disabled" }, 404);
}

// ─── Brute-force protection ──────────────────────────────────────────────────
const WINDOW_MS = 15 * 60_000;
const MAX_PER_IP = 5;
const MAX_GLOBAL = 30;

/** Returns seconds to wait, or 0 if the attempt may proceed. */
export async function rateLimited(store: Store, ip: string): Promise<number> {
  const since = Date.now() - WINDOW_MS;
  const [mine, all] = await Promise.all([store.failuresSince(ip, since), store.failuresSince(null, since)]);
  const blocked = mine.count >= MAX_PER_IP ? mine : all.count >= MAX_GLOBAL ? all : null;
  if (!blocked) return 0;
  return Math.max(1, Math.ceil(((blocked.oldest ?? Date.now()) + WINDOW_MS - Date.now()) / 1000));
}

// ─── Input validation helpers ────────────────────────────────────────────────
const B64 = /^[A-Za-z0-9+/=_-]+$/;
export const isB64 = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && B64.test(v);
export const MAX_DATA = 4_000_000; // ~3 MB of ciphertext
