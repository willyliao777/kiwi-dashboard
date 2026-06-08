import { NextRequest, NextResponse } from "next/server";
import { listApiKeys, createApiKey } from "@/lib/redis";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-key") === process.env.KIWI_API_KEY;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = await listApiKeys();
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const result = await createApiKey(String(name).slice(0, 80));
  return NextResponse.json(result);
}
