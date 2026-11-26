import { logoPng } from "@/lib/logoPng";

const SIZES = new Set([192, 512]);

/** /app-icon/192 and /app-icon/512 — PWA icons for the web manifest. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number((await params).size);
  if (!SIZES.has(n)) return new Response("Not found", { status: 404 });
  const res = await logoPng(n);
  res.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return res;
}
