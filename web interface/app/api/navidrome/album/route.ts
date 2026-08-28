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

  if (!id) {
    return NextResponse.json({ error: "Missing album ID", song_ids: [] }, { status: 400 });
  }

  const baseUrl = process.env.NAVIDROME_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Navidrome not configured", song_ids: [] },
      { status: 500 }
    );
  }

  const auth = buildAuth();
  auth.set("id", id);

  try {
    const res = await fetch(`${baseUrl}/rest/getAlbum.view?${auth.toString()}`, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Navidrome HTTP ${res.status}`, song_ids: [] },
        { status: 502 }
      );
    }

    const data = await res.json();
    const response = data["subsonic-response"];

    if (response?.status !== "ok") {
      const errMsg = response?.error?.message ?? "Unknown Navidrome error";
      return NextResponse.json({ error: errMsg, song_ids: [] }, { status: 502 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawSongs: any[] = response.album?.song ?? [];

    const songs = rawSongs.map((s) => ({
      id: String(s.id),
      title: s.title ?? "Unknown Title",
      artist: s.artist ?? s.albumArtist ?? "Unknown Artist",
      album: s.album ?? "Unknown Album",
      duration: typeof s.duration === "number" ? s.duration : 0,
      coverArt: s.coverArt ? String(s.coverArt) : null,
    }));

    const song_ids = songs.map((s) => s.id);

    return NextResponse.json({ song_ids, songs });
  } catch (err) {
    console.error("[navidrome/album] fetch error:", err);
    return NextResponse.json(
      { error: "Failed to reach Navidrome", song_ids: [], songs: [] },
      { status: 502 }
    );
  }
}
