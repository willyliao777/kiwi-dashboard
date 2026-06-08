import { NextResponse } from "next/server";
import { redis, KINDS } from "@/lib/redis";

export async function GET() {
  const now = new Date();
  const dayKey  = `kiwi:stats:day:${now.toISOString().slice(0, 10)}`;
  const hourKey = `kiwi:stats:hour:${now.toISOString().slice(0, 13)}`;

  const [total, today, thisHour, agents, ...kindCounts] = await Promise.all([
    redis.get<number>("kiwi:stats:total"),
    redis.get<number>(dayKey),
    redis.get<number>(hourKey),
    redis.hgetall("kiwi:agents"),
    ...KINDS.map(k => redis.get<number>(`kiwi:stats:kind:${k}`)),
  ]);

  const byKind: Record<string, number> = {};
  KINDS.forEach((k, i) => { byKind[k] = Number(kindCounts[i] ?? 0); });

  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const agentMap = (agents ?? {}) as Record<string, string>;
  const activeAgents = Object.entries(agentMap)
    .map(([id, ts]) => ({ id, lastSeen: Number(ts) }))
    .filter(a => a.lastSeen > fiveMinAgo)
    .sort((a, b) => b.lastSeen - a.lastSeen);

  const allAgents = Object.entries(agentMap)
    .map(([id, ts]) => ({ id, lastSeen: Number(ts) }))
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 20);

  return NextResponse.json({
    total:        Number(total ?? 0),
    today:        Number(today ?? 0),
    thisHour:     Number(thisHour ?? 0),
    activeAgents: activeAgents.length,
    allAgents,
    byKind,
  });
}
