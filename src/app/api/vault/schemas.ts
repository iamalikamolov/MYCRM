import { z } from "zod";
import { MAX_DATA } from "@/server/http";

const b64 = (max: number) => z.string().min(1).max(max).regex(/^[A-Za-z0-9+/=_-]+$/);

export const blob = { iv: b64(64), ct: (max: number) => b64(max) };

export const LoginBody = z.object({ authToken: b64(128) });

export const SetupBody = z.object({
  setupCode: z.string().min(1).max(200),
  salt: b64(64),
  iter: z.number().int().min(100_000).max(5_000_000),
  checkIv: b64(64),
  checkCt: b64(256),
  authToken: b64(128),
  dataIv: b64(64).nullable(),
  dataCt: b64(MAX_DATA).nullable(),
});

export const PutBody = z.object({
  version: z.number().int().min(1),
  dataIv: b64(64),
  dataCt: b64(MAX_DATA),
});

export const PasswordBody = SetupBody.omit({ setupCode: true }).extend({ version: z.number().int().min(1) });

export const ResetBody = z.object({ setupCode: z.string().min(1).max(200) });

/** Parse JSON body with a size cap; returns null on anything malformed. */
export async function readJson<T>(req: Request, schema: z.ZodType<T>, maxBytes = MAX_DATA + 10_000): Promise<T | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    const r = schema.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
