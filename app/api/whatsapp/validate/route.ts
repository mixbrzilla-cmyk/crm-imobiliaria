import { NextResponse } from "next/server";

import { validateZApiConnection } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const instance_id = String(body?.instance_id ?? "").trim();
  const token = String(body?.token ?? "").trim();

  if (!instance_id || !token) {
    return NextResponse.json({ ok: false, error: "instance_id e token são obrigatórios" }, { status: 400 });
  }

  try {
    const res = await validateZApiConnection({ instance_id, token });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: res.data, url: res.url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Falha ao validar conexão." }, { status: 500 });
  }
}
