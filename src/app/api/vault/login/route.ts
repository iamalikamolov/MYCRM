import type { NextRequest } from "next/server";
import { ipHash, json, rateLimited, requireStore, safeEqual, sameOrigin, setSession, sha256 } from "@/server/http";
import { LoginBody, readJson } from "../schemas";

export const dynamic = "force-dynamic";

/** Owner login: the browser proves it knows the password by sending a token derived from it. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "bad_origin" }, 403);
  const store = requireStore();
  if (!("get" in store)) return store;
  const ip = ipHash(req);
  const wait = await rateLimited(store, ip);
  if (wait) return json({ error: "rate_limited", retryAfter: wait }, 429, { "Retry-After": String(wait) });
  const body = await readJson(req, LoginBody, 1000);
  const a = await store.get();
  if (!body || !a) return json({ error: "bad_request" }, 400);
  const ok = safeEqual(sha256(body.authToken), a.authHash);
  await store.recordAttempt(ip, ok);
  if (!ok) return json({ error: "wrong_password" }, 401);
  return setSession(
    json({ version: a.version, checkIv: a.checkIv, checkCt: a.checkCt, dataIv: a.dataIv, dataCt: a.dataCt }),
    req,
    a,
  );
}
