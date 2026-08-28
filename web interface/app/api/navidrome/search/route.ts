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
  const q = req.nextUrl.searchParams.get("q") ?? "";

  if (q.trim().length < 3) {
    return NextResponse.json({ songs: [] });
  }

  const baseUrl = process.env.NAVIDROME_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Navidrome not configured", songs: [] },
      { status: 500 }
    );
  }

  const auth = buildAuth();
  auth.set("query", q.trim());
  auth.set("songCount", "30");
  auth.set("albumCount", "10");
  auth.set("artistCount", "0");

  try {
    const res = await fetch(`${baseUrl}/rest/search3.view?${auth.toString()}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Navidrome HTTP ${res.status}`, songs: [], albums: [] },
        { status: 502 }
      );
    }

    const data = await res.json();
    const response = data["subsonic-response"];

    if (response?.status !== "ok") {
      const errMsg = response?.error?.message ?? "Unknown Navidrome error";
      return NextResponse.json({ error: errMsg, songs: [], albums: [] }, { status: 502 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawSongs: any[] = response.searchResult3?.song ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawAlbums: any[] = response.searchResult3?.album ?? [];

    const songs = rawSongs.map((s) => ({
      id: String(s.id),
      title: s.title ?? "Unknown Title",
      artist: s.artist ?? s.albumArtist ?? "Unknown Artist",
      album: s.album ?? "Unknown Album",
      duration: typeof s.duration === "number" ? s.duration : 0,
      coverArt: s.coverArt ? String(s.coverArt) : null,
    }));

    const albums = rawAlbums.map((a) => ({
      id: String(a.id),
      title: a.name ?? a.title ?? "Unknown Album",
      artist: a.artist ?? "Unknown Artist",
      songCount: typeof a.songCount === "number" ? a.songCount : 0,
      duration: typeof a.duration === "number" ? a.duration : 0,
      coverArt: a.coverArt ? String(a.coverArt) : null,
    }));

    return NextResponse.json({ songs, albums });
  } catch (err) {
    console.error("[navidrome/search] fetch error:", err);
    return NextResponse.json(
      { error: "Failed to reach Navidrome", songs: [] },
      { status: 502 }
    );
  }
}
