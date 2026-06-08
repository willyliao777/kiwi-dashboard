import { NextRequest, NextResponse } from "next/server";
import { redis, KINDS } from "@/lib/redis";
import type { ThreatEvent } from "@/lib/redis";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.KIWI_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Omit<ThreatEvent, "id" | "timestamp">;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.agentId || !body.layer || !Array.isArray(body.threats)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const event: ThreatEvent = {
    id: crypto.randomUUID(),
    agentId: String(body.agentId).slice(0, 100),
    layer: body.layer,
    threats: body.threats.slice(0, 20),
    sanitized: String(body.sanitized ?? "").slice(0, 500),
    isSuspicious: Boolean(body.isSuspicious),
    meta: body.meta,
    timestamp: Date.now(),
  };

  const now = new Date();
  const dayKey  = `kiwi:stats:day:${now.toISOString().slice(0, 10)}`;
  const hourKey = `kiwi:stats:hour:${now.toISOString().slice(0, 13)}`;

  await Promise.all([
    redis.lpush("kiwi:events", JSON.stringify(event)),
    redis.ltrim("kiwi:events", 0, 999),
    redis.incr("kiwi:stats:total"),
    redis.incr(dayKey),
    redis.expire(dayKey, 60 * 60 * 48),
    redis.incr(hourKey),
    redis.expire(hourKey, 60 * 60 * 2),
    redis.hset("kiwi:agents", { [event.agentId]: event.timestamp }),
    ...event.threats.map(t =>
      KINDS.includes(t.kind as typeof KINDS[number])
        ? redis.incr(`kiwi:stats:kind:${t.kind}`)
        : Promise.resolve()
    ),
  ]);

  return NextResponse.json({ ok: true, id: event.id });
}
