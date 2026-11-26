import type { NextRequest } from "next/server";
import { clearSession, json, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: "bad_origin" }, 403);
  return clearSession(json({ ok: true }));
}
