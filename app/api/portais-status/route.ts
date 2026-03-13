import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { schema: "public" },
  });
}

function safeObject(value: any) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

const PORTAL_COLUMNS = [
  "portals_json",
  "portal_status_json",
  "portais_json",
  "portais_status_json",
  "integrations_json",
] as const;

type EntityType = "property" | "development";

type PortalKey = "olx" | "zap" | "vivareal";

export async function POST(req: Request) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "Service role não configurada. Defina SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor.",
      },
      { status: 500 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  const entityType = String(body?.entityType ?? "").trim() as EntityType;
  const id = String(body?.id ?? "").trim();
  const portal = String(body?.portal ?? "").trim().toLowerCase() as PortalKey;
  const value = Boolean(body?.value);

  if (entityType !== "property" && entityType !== "development") {
    return NextResponse.json({ ok: false, error: "entityType inválido" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ ok: false, error: "id obrigatório" }, { status: 400 });
  if (portal !== "olx" && portal !== "zap" && portal !== "vivareal") {
    return NextResponse.json({ ok: false, error: "portal inválido" }, { status: 400 });
  }

  const table = entityType === "property" ? "properties" : "developments";

  for (const col of PORTAL_COLUMNS) {
    const selectRes = await (supabase as any).from(table).select(`id, ${col}`).eq("id", id).maybeSingle();

    if (selectRes.error) {
      const msg = String(selectRes.error.message ?? "");
      const code = (selectRes.error as any)?.code;
      const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
      const isMissing = /does not exist|not found|column/i.test(msg);
      if (isSchemaMismatch || isMissing) continue;
      return NextResponse.json({ ok: false, error: selectRes.error.message, details: selectRes.error }, { status: 400 });
    }

    const currentRaw = (selectRes.data as any)?.[col] ?? null;
    const current = (safeObject(currentRaw) as any) ?? {};

    const merged: any = { ...current };
    merged[portal] = value;

    const updateRes = await (supabase as any).from(table).update({ [col]: merged }).eq("id", id);
    if (updateRes.error) {
      const msg = String(updateRes.error.message ?? "");
      const code = (updateRes.error as any)?.code;
      const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
      const isMissing = /does not exist|not found|column/i.test(msg);
      if (isSchemaMismatch || isMissing) continue;
      return NextResponse.json({ ok: false, error: updateRes.error.message, details: updateRes.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, column: col, value: merged });
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        "Nenhuma coluna de status de portais encontrada. Crie uma coluna JSONB (ex: portals_json) em properties/developments.",
    },
    { status: 400 },
  );
}
