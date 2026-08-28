import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function buildAuth() {
  const salt = crypto.randomBytes(6).toString("hex");
  const token = crypto
    .createHash("md5")
    .update((process.env.NAVIDROME_PASS ?? "") + salt)
    .digest("hex");
  return new URLSearchParams({
    u: process.env.NAVIDROME_USER ?? "",
    t: token,
    s: salt,
    v: "1.16.1",
    c: "led-matrix",
    f: "json",
  });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const size = req.nextUrl.searchParams.get("size") ?? "150";

  if (!id) {
    return new NextResponse(null, { status: 400 });
  }

  const baseUrl = process.env.NAVIDROME_URL;
  if (!baseUrl) {
    return new NextResponse(null, { status: 500 });
  }

  const auth = buildAuth();
  auth.set("id", id);
  auth.set("size", size);

  try {
    const res = await fetch(
      `${baseUrl}/rest/getCoverArt.view?${auth.toString()}`
    );

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[navidrome/art] fetch error:", err);
    return new NextResponse(null, { status: 502 });
  }
}
