import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/** Renders public/logo.svg as a square PNG (home-screen / PWA icons). */
export async function logoPng(size: number): Promise<ImageResponse> {
  const svg = await readFile(path.join(process.cwd(), "public", "logo.svg"));
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  return new ImageResponse(
    (
      // iOS rounds the corners itself, so fill the whole square with the tile colour first.
      <div style={{ width: size, height: size, display: "flex", background: "#B55B12" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain img */}
        <img src={src} width={size} height={size} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
