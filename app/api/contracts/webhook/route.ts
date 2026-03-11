import { NextResponse } from "next/server";

import { getSupabaseClient } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

// Expected payload example:
// {
//   "external_id": "provider-contract-id",
//   "event": "signed"
// }
export async function POST(req: Request) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const externalId = String(body?.external_id ?? "").trim();
  const event = String(body?.event ?? "").trim().toLowerCase();

  if (!externalId) {
    return NextResponse.json({ ok: false, error: "external_id é obrigatório" }, { status: 400 });
  }

  if (event !== "signed" && event !== "assinado") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const res = await (supabase as any)
      .from("contracts")
      .update({ status: "assinado" })
      .eq("signature_external_id", externalId);

    if (res.error) {
      return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Falha ao processar webhook." }, { status: 500 });
  }
}
