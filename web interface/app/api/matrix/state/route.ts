import { NextResponse } from "next/server";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = fs.readFileSync("/tmp/led_matrix_state.json", "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (e) {
    // If file doesn't exist or is invalid, return default idle state
    return NextResponse.json({ algo: null, song_id: null, is_paused: false });
  }
}
