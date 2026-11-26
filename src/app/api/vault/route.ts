import type { NextRequest } from "next/server";
import { authed, json, requireStore, sameOrigin } from "@/server/http";
import { PutBody, readJson } from "./schemas";

export const dynamic = "force-dynamic";

/** Encrypted vault for the signed-in owner. `?v=N` → 204 when nothing changed since version N. */
export async function GET(req: NextRequest) {
  const store = requireStore();
  if (!("get" in store)) return store;
  const a = await authed(req, store);
  if (!a) return json({ error: "unauthorized" }, 401);
  const v = Number(req.nextUrl.searchParams.get("v"));
  if (v && v === a.version) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  return json({ version: a.version, checkIv: a.checkIv, checkCt: a.checkCt, dataIv: a.dataIv, dataCt: a.dataCt, updatedAt: a.updatedAt });
}

/** Save new ciphertext. Fails with 409 if another device saved first. */
export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "bad_origin" }, 403);
  const store = requireStore();
  if (!("get" in store)) return store;
  const a = await authed(req, store);
  if (!a) return json({ error: "unauthorized" }, 401);
  const body = await readJson(req, PutBody);
  if (!body) return json({ error: "bad_request" }, 400);
  const r = await store.update(body.version, { dataIv: body.dataIv, dataCt: body.dataCt });
  if (!r.ok) {
    const cur = await store.get();
    return json({ error: "conflict", version: cur?.version ?? 0 }, 409);
  }
  return json({ version: r.version });
}
