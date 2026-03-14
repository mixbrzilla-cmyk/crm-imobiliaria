import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = String(searchParams.get("url") ?? "").trim();

  if (!raw || !isHttpUrl(raw)) {
    return NextResponse.json({ ok: false, error: "URL inválida." }, { status: 400 });
  }

  try {
    const upstream = await fetch(raw, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      headers: {
        "User-Agent": "super-crm-imob/1.0",
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: `Falha ao buscar avatar (HTTP ${upstream.status}).` },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const ab = await upstream.arrayBuffer();

    if (ab.byteLength > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Avatar muito grande." }, { status: 413 });
    }

    return new Response(ab, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Falha ao buscar avatar." }, { status: 500 });
  }
}
