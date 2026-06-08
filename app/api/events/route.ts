import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  const raw = await redis.lrange("kiwi:events", 0, limit - 1);
  const events = raw.map(e => (typeof e === "string" ? JSON.parse(e) : e));

  return NextResponse.json(events);
}
