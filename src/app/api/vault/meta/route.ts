import { getStore } from "@/server/store";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

/** Public: is cloud sync on, does an account exist, and its KDF salt (not secret). */
export async function GET() {
  const store = getStore();
  if (!store) return json({ enabled: false });
  const a = await store.get();
  return json({ enabled: true, exists: !!a, salt: a?.salt ?? null, iter: a?.iter ?? null });
}
