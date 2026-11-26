import type { NextRequest } from "next/server";
import { clearSession, ipHash, json, rateLimited, requireStore, safeEqual, sameOrigin } from "@/server/http";
import { readJson, ResetBody } from "../schemas";

export const dynamic = "force-dynamic";

/** "Forgot password": data can't be decrypted without it, so the vault is deleted (needs SETUP_CODE). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "bad_origin" }, 403);
  const store = requireStore();
  if (!("get" in store)) return store;
  const ip = ipHash(req);
  const wait = await rateLimited(store, ip);
  if (wait) return json({ error: "rate_limited", retryAfter: wait }, 429, { "Retry-After": String(wait) });
  const body = await readJson(req, ResetBody, 1000);
  const code = process.env.SETUP_CODE;
  if (!body || !code || !safeEqual(body.setupCode.trim(), code)) {
    await store.recordAttempt(ip, false);
    return json({ error: "bad_setup_code" }, 403);
  }
  await store.remove();
  return clearSession(json({ ok: true }));
}
