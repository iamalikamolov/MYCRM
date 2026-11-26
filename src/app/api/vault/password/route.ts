import type { NextRequest } from "next/server";
import { authed, json, requireStore, sameOrigin, setSession, sha256 } from "@/server/http";
import { PasswordBody, readJson } from "../schemas";

export const dynamic = "force-dynamic";

/** Password change: everything re-encrypted in the browser; other devices are signed out. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "bad_origin" }, 403);
  const store = requireStore();
  if (!("get" in store)) return store;
  const a = await authed(req, store);
  if (!a) return json({ error: "unauthorized" }, 401);
  const body = await readJson(req, PasswordBody);
  if (!body) return json({ error: "bad_request" }, 400);
  const r = await store.update(body.version, {
    salt: body.salt,
    iter: body.iter,
    checkIv: body.checkIv,
    checkCt: body.checkCt,
    authHash: sha256(body.authToken),
    dataIv: body.dataIv,
    dataCt: body.dataCt,
    sessionVersion: a.sessionVersion + 1,
  });
  if (!r.ok) return json({ error: "conflict" }, 409);
  return setSession(json({ version: r.version }), req, { sessionVersion: a.sessionVersion + 1 });
}
