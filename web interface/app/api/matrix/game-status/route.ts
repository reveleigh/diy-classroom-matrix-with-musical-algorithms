import connectToDatabase from "@/lib/mongodb";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const MathSessionSchema = new mongoose.Schema({
  sessionId: { type: String, default: "active_session", unique: true },
  status: { type: String, default: "lobby" },
  score: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

const MathSession = mongoose.models.MathSession || mongoose.model("MathSession", MathSessionSchema);

export async function GET() {
  try {
    await connectToDatabase();
    let session = await MathSession.findOne({ sessionId: "active_session" });
    if (!session) {
      session = await MathSession.create({ sessionId: "active_session", status: "lobby" });
    }
    return NextResponse.json({ status: session.status, score: session.score });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { status, score } = await req.json();
    await connectToDatabase();
    
    const update: any = { updatedAt: new Date() };
    if (status !== undefined) update.status = status;
    if (score !== undefined) update.score = score;
    
    const session = await MathSession.findOneAndUpdate(
      { sessionId: "active_session" },
      update,
      { new: true, upsert: true }
    );
    
    return NextResponse.json({ success: true, status: session.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
