import type { NextRequest } from "next/server";
import { ipHash, json, rateLimited, requireStore, safeEqual, sameOrigin, setSession, sha256 } from "@/server/http";
import { readJson, SetupBody } from "../schemas";

export const dynamic = "force-dynamic";

/**
 * First-time setup. Protected by SETUP_CODE (set in the hosting env vars) so a stranger
 * who finds the URL first cannot claim the vault.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "bad_origin" }, 403);
  const store = requireStore();
  if (!("get" in store)) return store;
  const ip = ipHash(req);
  const wait = await rateLimited(store, ip);
  if (wait) return json({ error: "rate_limited", retryAfter: wait }, 429, { "Retry-After": String(wait) });
  const body = await readJson(req, SetupBody);
  if (!body) return json({ error: "bad_request" }, 400);
  const code = process.env.SETUP_CODE;
  if (!code || !safeEqual(body.setupCode.trim(), code)) {
    await store.recordAttempt(ip, false);
    return json({ error: "bad_setup_code" }, 403);
  }
  const created = await store.create({
    salt: body.salt,
    iter: body.iter,
    checkIv: body.checkIv,
    checkCt: body.checkCt,
    authHash: sha256(body.authToken),
    dataIv: body.dataIv,
    dataCt: body.dataCt,
  });
  if (!created) return json({ error: "exists" }, 409);
  await store.recordAttempt(ip, true);
  const a = await store.get();
  return setSession(json({ version: a?.version ?? 1 }), req, { sessionVersion: a?.sessionVersion ?? 1 });
}
