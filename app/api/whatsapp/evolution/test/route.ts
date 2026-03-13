import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeBaseUrl(url: string) {
  const raw = String(url ?? "").trim();
  return raw.replace(/\/+$/, "");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const apiUrl = normalizeBaseUrl(String(body?.api_url ?? ""));
  const globalKey = String(body?.global_api_key ?? "").trim();

  if (!apiUrl || !globalKey) {
    return NextResponse.json(
      { ok: false, error: "api_url e global_api_key são obrigatórios" },
      { status: 400 },
    );
  }

  const candidates = [apiUrl, `${apiUrl}/health`, `${apiUrl}/api/health`];

  let lastError = "";

  for (const url of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, {
        method: "GET",
        headers: {
          apikey: globalKey,
          "x-api-key": globalKey,
          "X-Api-Key": globalKey,
          Authorization: `Bearer ${globalKey}`,
        },
        cache: "no-store",
      });

      if (res.ok) {
        const text = await res.text().catch(() => "");
        return NextResponse.json({
          ok: true,
          message: `Servidor respondeu em ${url} (HTTP ${res.status}).`,
          data: text ? text.slice(0, 300) : null,
        });
      }

      const text = await res.text().catch(() => "");
      lastError = `HTTP ${res.status} em ${url}. ${text}`.trim();
    } catch (e: any) {
      lastError = e?.message ? String(e.message) : "Falha ao conectar.";
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: lastError || "Falha ao conectar na Evolution API.",
    },
    { status: 502 },
  );
}
