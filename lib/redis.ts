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
