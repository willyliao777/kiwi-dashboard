import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const KINDS = [
  "OUTPUT_HIJACK",
  "INDIRECT_INJECTION",
  "COMMAND_INJECTION",
  "SCRIPT_TAG",
  "BRACE_OVERRIDE",
  "HIDDEN_CHARACTER",
  "HOMOGLYPH_ATTACK",
  "SPECIAL_TOKEN",
  "CODE_FENCE_INJECTION",
] as const;

export type ThreatKind = typeof KINDS[number];

export interface ThreatEvent {
  id: string;
  agentId: string;
  layer: "user_input" | "rag" | "tool_output" | "llm_output";
  threats: { kind: string; charPos: number; raw: string }[];
  sanitized: string;
  isSuspicious: boolean;
  meta?: { toolName?: string; originalTask?: string };
  timestamp: number;
}

export interface ApiKey {
  id: string;
  name: string;
  createdAt: number;
  active: boolean;
}

export async function validateApiKey(key: string): Promise<boolean> {
  const raw = await redis.hget("kiwi:apikeys", key);
  if (raw) {
    const meta: ApiKey = typeof raw === "string" ? JSON.parse(raw) : raw as ApiKey;
    if (meta.active) return true;
  }
  // fallback to env var so existing key still works
  return key === process.env.KIWI_API_KEY;
}

export async function listApiKeys(): Promise<(ApiKey & { key: string })[]> {
  const all = await redis.hgetall("kiwi:apikeys");
  if (!all) return [];
  return Object.entries(all).map(([key, raw]) => {
    const meta: ApiKey = typeof raw === "string" ? JSON.parse(raw) : raw as ApiKey;
    return { ...meta, key };
  }).sort((a, b) => b.createdAt - a.createdAt);
}

export async function createApiKey(name: string): Promise<{ key: string; id: string }> {
  const id = crypto.randomUUID();
  const key = `kiwi_live_${id.replace(/-/g, "").slice(0, 16)}`;
  const meta: ApiKey = { id, name, createdAt: Date.now(), active: true };
  await redis.hset("kiwi:apikeys", { [key]: JSON.stringify(meta) });
  return { key, id };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const all = await redis.hgetall("kiwi:apikeys");
  if (!all) return false;
  const entry = Object.entries(all).find(([, raw]) => {
    const meta: ApiKey = typeof raw === "string" ? JSON.parse(raw) : raw as ApiKey;
    return meta.id === id;
  });
  if (!entry) return false;
  const [key, raw] = entry;
  const meta: ApiKey = typeof raw === "string" ? JSON.parse(raw) : raw as ApiKey;
  await redis.hset("kiwi:apikeys", { [key]: JSON.stringify({ ...meta, active: false }) });
  return true;
}
