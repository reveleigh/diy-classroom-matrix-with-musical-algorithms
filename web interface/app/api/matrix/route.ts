import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

const VALID_ALGOS = [
  "bubble",
  "quick",
  "selection",
  "insertion",
  "merge",
  "radix",
  "bogo",
  "cocktail",
  "lifegoeson",
  "song",
  "game",
  "image",
  "gif",
  "idle",
  "shutdown",
  "text",
  "time",
  "countdown",
  "brightness",
  "math_question",
  "math_help",
  "math_feedback",
  "pathfinding",
  "volume",
  "navidrome",
  "pause",
  "resume",
  "prev",
  "next",
  "math_start",
  "set_vis_mode",
  "rickroll",
  "simulate_button",
  "linear_search",
  "binary_search",
];

export async function POST(req: Request) {
  try {
    // 1. Authentication Check (Placeholder - Add your own logic here)
    // const userId = getYourAuthMethod(req);
    // if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 4. Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { algo, type, speed, sound, volume, x, y, pixels, text, font, scroll, seconds, layout, color, brightness, factorA, factorB, sound_file, song_id, song_ids, start, target, walls, array, music_file, music_volume, game_volume, time_limit, mode, allowed_multiply, allowed_divide, vis_mode, artwork_pixels, frames, btn } = body;
    if (!algo) {
      return NextResponse.json(
        { error: "Missing algorithm parameter" },
        { status: 400 }
      );
    }

    // Validate algorithm
    if (!VALID_ALGOS.includes(algo)) {
      return NextResponse.json(
        { error: `Invalid algorithm. Supported: ${VALID_ALGOS.join(", ")}` },
        { status: 400 }
      );
    }

    // 3. Environment Variables Check
    const targetUrl = process.env.MATRIX_API_URL;
    const apiKey = process.env.MATRIX_API_KEY;

    if (!targetUrl || !apiKey) {
      console.error("Missing matrix configuration environment variables.");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 4. Securely forward the request to the home server reverse proxy
    const sanitizedText = text ? String(text) : text;
    const sanitizedSoundFile = sound_file ? String(sound_file) : sound_file;
    const sanitizedMusicFile = music_file ? String(music_file) : music_file;
    const sanitizedSongId = song_id ? String(song_id) : song_id;
    const sanitizedFont = font ? String(font) : font;
    const sanitizedType = type ? String(type) : type;
    
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ algo, type: sanitizedType, speed, sound, volume, x, y, pixels, text: sanitizedText, font: sanitizedFont, scroll, seconds, layout, color, brightness, factorA, factorB, sound_file: sanitizedSoundFile, song_id: sanitizedSongId, song_ids, start, target, walls, array, music_file: sanitizedMusicFile, music_volume, game_volume, time_limit, mode, allowed_multiply, allowed_divide, vis_mode, artwork_pixels, frames, btn }),
    });

    // 5. Handle response and errors
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Matrix server error: ${errorText}` },
        { status: response.status }
      );
    }

    // Parse according to content-type header from Node-RED
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const text = await response.text();
      return NextResponse.json({ success: true, details: text });
    }
  } catch (error: any) {
    console.error("Matrix control routing error:", error);
    try {
      const fs = require("fs");
      const path = require("path");
      const logMsg = `[${new Date().toISOString()}] Error: ${error?.message || "unknown"}\nStack: ${error?.stack || "none"}\n\n`;
      fs.appendFileSync(path.join(process.cwd(), "error.log"), logMsg);
    } catch (logErr) {
      console.error("Failed to write error log:", logErr);
    }
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
