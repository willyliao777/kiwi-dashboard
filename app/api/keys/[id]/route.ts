import { NextRequest, NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/redis";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get("x-admin-key") !== process.env.KIWI_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const ok = await revokeApiKey(id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Key not found" }, { status: 404 });
}
