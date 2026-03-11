"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type Mode = "imovel" | "empreendimento";

type FormState = {
  mode: Mode;
  title: string;
  city: string;
  neighborhood: string;
  price: string;
  owner_name: string;
  owner_whatsapp: string;
};

type CapturedRow = {
  id: string;
  source: "properties" | "developments";
  data: any;
};

function normalizeWhatsapp(v: string) {
  return String(v ?? "").replace(/\D+/g, "").trim();
}

function formatCurrencyBRL(value: any) {
  const n = typeof value === "number" ? value : value != null ? Number(value) : NaN;
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pickBeds(row: any) {
  const v = row?.bedrooms ?? row?.quartos ?? null;
  const n = typeof v === "number" ? v : v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickBaths(row: any) {
  const v = row?.bathrooms ?? row?.banheiros ?? null;
  const n = typeof v === "number" ? v : v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function parseBRLInputToNumber(value: string) {
  const raw = String(value ?? "")
    .replace(/\./g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.\-]/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function maskBRLInput(value: string) {
  const digits = String(value ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  if (!Number.isFinite(cents)) return "";
  const amount = cents / 100;
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CorretorInventarioPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [propertiesAssignColumn, setPropertiesAssignColumn] = useState<"assigned_broker_id" | "broker_id" | "corretor_id">(
    "corretor_id",
  );
  const [developmentsAssignColumn, setDevelopmentsAssignColumn] = useState<"assigned_broker_id" | "broker_id" | "corretor_id">(
    "broker_id",
  );

  const [form, setForm] = useState<FormState>({
    mode: "imovel",
    title: "",
    city: "Marabá",
    neighborhood: "",
    price: "",
    owner_name: "",
    owner_whatsapp: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  const [capturedLoading, setCapturedLoading] = useState(true);
  const [capturedError, setCapturedError] = useState<string | null>(null);
  const [capturedRows, setCapturedRows] = useState<CapturedRow[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setErrorMessage(null);

        if (!supabase) {
          setErrorMessage(
            "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
          );
          setIsLoading(false);
          return;
        }

        try {
          const testAssigned = await (supabase as any)
            .from("properties")
            .select("id, assigned_broker_id")
            .limit(1);
          if (!testAssigned?.error) {
            setPropertiesAssignColumn("assigned_broker_id");
          } else {
            const testBroker = await (supabase as any).from("properties").select("id, broker_id").limit(1);
            setPropertiesAssignColumn(testBroker?.error ? "corretor_id" : "broker_id");
          }
        } catch {
          setPropertiesAssignColumn("corretor_id");
        }

        try {
          const testAssigned = await (supabase as any)
            .from("developments")
            .select("id, assigned_broker_id")
            .limit(1);
          if (!testAssigned?.error) {
            setDevelopmentsAssignColumn("assigned_broker_id");
          } else {
            const testBroker = await (supabase as any).from("developments").select("id, broker_id").limit(1);
            setDevelopmentsAssignColumn(testBroker?.error ? "corretor_id" : "broker_id");
          }
        } catch {
          setDevelopmentsAssignColumn("corretor_id");
        }

        setIsLoading(false);
      })();
    }, 0);

    return () => window.clearTimeout(t);
  }, [supabase]);

  const loadCaptured = useCallback(async () => {
    setCapturedError(null);
    setCapturedLoading(true);

    if (!supabase) {
      setCapturedRows([]);
      setCapturedLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setCapturedRows([]);
      setCapturedLoading(false);
      return;
    }

    const brokerId = authData.user.id;

    try {
      const brokerColumns: Array<"assigned_broker_id" | "broker_id" | "corretor_id"> = [
        "assigned_broker_id",
        "broker_id",
        "corretor_id",
      ];

      const union = new Map<string, CapturedRow>();

      async function loadCapturedFromTable(table: "properties" | "developments") {
        for (const col of brokerColumns) {
          const attempts: Array<Promise<any>> = [
            (supabase as any)
              .from(table)
              .select("*")
              .eq(col, brokerId)
              .or("source_type.eq.broker_capture,source_type.is.null")
              .order("created_at", { ascending: false })
              .limit(200),
            (supabase as any)
              .from(table)
              .select("*")
              .eq(col, brokerId)
              .or("source_type.eq.broker_capture,source_type.is.null")
              .limit(200),
            (supabase as any).from(table).select("*").eq(col, brokerId).limit(200),
          ];

          let last: any = null;
          for (const q of attempts) {
            const res = await q;
            last = res;
            if (!res?.error) break;

            const msg = String(res.error?.message ?? "");
            const code = (res.error as any)?.code;
            const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
            const isSourceTypeMissing = /column\s+\"?source_type\"?\s+does\s+not\s+exist|source_type\s+not\s+found/i.test(msg);
            const isCreatedAtMissing = /created_at/i.test(msg);
            const isAssignColMissing = new RegExp(`column\\s+\\"?${col}\\"?\\s+does\\s+not\\s+exist|${col}\\s+not\\s+found`, "i").test(
              msg,
            );

            if (isAssignColMissing) {
              last = null;
              break;
            }

            if (!isSchemaMismatch && !isSourceTypeMissing && !isCreatedAtMissing) break;
          }

          const data = (last?.data ?? []) as Array<any>;
          for (const r of data) {
            const id = String(r?.id ?? "");
            if (!id) continue;
            union.set(`${table}:${id}`, { id, source: table, data: r } as CapturedRow);
          }
        }
      }

      await loadCapturedFromTable("properties");
      await loadCapturedFromTable("developments");

      const nextRows = Array.from(union.values());

      nextRows.sort((a, b) => {
        const aT = a?.data?.created_at ? Date.parse(String(a.data.created_at)) : 0;
        const bT = b?.data?.created_at ? Date.parse(String(b.data.created_at)) : 0;
        return bT - aT;
      });

      setCapturedRows(nextRows);
      setCapturedLoading(false);
    } catch {
      setCapturedError("Não foi possível carregar suas captações agora.");
      setCapturedRows([]);
      setCapturedLoading(false);
    }
  }, [supabase, propertiesAssignColumn, developmentsAssignColumn]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCaptured();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadCaptured]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supabase) {
      setErrorMessage("Supabase não configurado.");
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setErrorMessage("Sessão expirada. Faça login novamente.");
      return;
    }

    const brokerId = authData.user.id;

    const ownerWhatsapp = normalizeWhatsapp(form.owner_whatsapp);

    setIsSaving(true);

    try {
      if (form.mode === "imovel") {
        const payloadBase: any = {
          id: crypto.randomUUID(),
          title: form.title.trim(),
          city: form.city.trim() ? form.city.trim() : null,
          neighborhood: form.neighborhood.trim() ? form.neighborhood.trim() : null,
          price: form.price.trim() ? parseBRLInputToNumber(form.price) : null,
          owner_whatsapp: ownerWhatsapp ? ownerWhatsapp : null,
          owner_name: form.owner_name.trim() ? form.owner_name.trim() : null,
          source_type: "broker_capture",
          [propertiesAssignColumn]: brokerId,
        };

        const payloadAttempts: Array<any> = [
          payloadBase,
          (() => {
            const p = { ...payloadBase };
            delete p.owner_name;
            return p;
          })(),
          (() => {
            const p = { ...payloadBase };
            delete p.source_type;
            return p;
          })(),
          (() => {
            const p = { ...payloadBase };
            delete p.owner_name;
            delete p.source_type;
            return p;
          })(),
        ];

        let lastError: any = null;
        for (const payload of payloadAttempts) {
          const res = await (supabase as any).from("properties").insert(payload);
          if (!res?.error) {
            lastError = null;
            break;
          }
          lastError = res.error;
          const msg = String(res.error?.message ?? "");
          const isOwnerNameMissing = /column\s+\"?owner_name\"?\s+does\s+not\s+exist|owner_name\s+not\s+found/i.test(msg);
          const isSourceTypeMissing = /column\s+\"?source_type\"?\s+does\s+not\s+exist|source_type\s+not\s+found/i.test(msg);
          const code = (res.error as any)?.code;
          const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
          if (!isOwnerNameMissing && !isSourceTypeMissing && !isSchemaMismatch) break;
        }

        if (lastError) {
          setErrorMessage(lastError.message);
          setIsSaving(false);
          return;
        }
      } else {
        const payloadBase: any = {
          id: crypto.randomUUID(),
          name: form.title.trim(),
          title: form.title.trim(),
          city: form.city.trim() ? form.city.trim() : null,
          localidade: form.neighborhood.trim() ? form.neighborhood.trim() : null,
          owner_whatsapp: ownerWhatsapp ? ownerWhatsapp : null,
          owner_name: form.owner_name.trim() ? form.owner_name.trim() : null,
          source_type: "broker_capture",
          [developmentsAssignColumn]: brokerId,
        };

        const payloadAttempts: Array<any> = [
          payloadBase,
          (() => {
            const p = { ...payloadBase };
            delete p.owner_name;
            return p;
          })(),
          (() => {
            const p = { ...payloadBase };
            delete p.source_type;
            return p;
          })(),
          (() => {
            const p = { ...payloadBase };
            delete p.owner_name;
            delete p.source_type;
            return p;
          })(),
        ];

        let lastError: any = null;
        for (const payload of payloadAttempts) {
          const res = await (supabase as any).from("developments").insert(payload);
          if (!res?.error) {
            lastError = null;
            break;
          }
          lastError = res.error;
          const msg = String(res.error?.message ?? "");
          const isOwnerNameMissing = /column\s+\"?owner_name\"?\s+does\s+not\s+exist|owner_name\s+not\s+found/i.test(msg);
          const isSourceTypeMissing = /column\s+\"?source_type\"?\s+does\s+not\s+exist|source_type\s+not\s+found/i.test(msg);
          const code = (res.error as any)?.code;
          const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
          if (!isOwnerNameMissing && !isSourceTypeMissing && !isSchemaMismatch) break;
        }

        if (lastError) {
          setErrorMessage(lastError.message);
          setIsSaving(false);
          return;
        }
      }

      setSuccessMessage("Captação enviada com sucesso. Já aparece no painel da Imobiliária Moderna.");
      setForm((s) => ({
        ...s,
        title: "",
        neighborhood: "",
        price: "",
        owner_name: "",
        owner_whatsapp: "",
      }));
    } catch {
      setErrorMessage("Não foi possível salvar agora.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-[color:var(--imob-navy)]">Meu Inventário (Captação)</div>
        <div className="text-xs text-zinc-500">
          Cadastre novos imóveis/empreendimentos no seu nome. A Imobiliária Moderna vê instantaneamente no Admin.
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        {isLoading ? (
          <div className="text-sm text-zinc-600">Carregando...</div>
        ) : (
          <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={save}>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">Tipo</span>
              <select
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[color:var(--imob-navy)] focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
                value={form.mode}
                onChange={(e) => setForm((s) => ({ ...s, mode: e.target.value as Mode }))}
              >
                <option value="imovel">Imóvel</option>
                <option value="empreendimento">Empreendimento</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">Título</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[color:var(--imob-navy)] focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                required
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">Cidade</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[color:var(--imob-navy)] focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
                value={form.city}
                onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">Bairro / Localidade</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[color:var(--imob-navy)] focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
                value={form.neighborhood}
                onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))}
              />
            </label>

            {form.mode === "imovel" ? (
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-600">Valor (R$)</span>
                <input
                  className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[color:var(--imob-navy)] focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
                  value={form.price}
                  onChange={(e) => setForm((s) => ({ ...s, price: maskBRLInput(e.target.value) }))}
                  inputMode="decimal"
                />
              </label>
            ) : (
              <div />
            )}

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">Nome do Proprietário</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[color:var(--imob-navy)] focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
                value={form.owner_name}
                onChange={(e) => setForm((s) => ({ ...s, owner_name: e.target.value }))}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">WhatsApp do Proprietário</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[color:var(--imob-navy)] focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
                value={form.owner_whatsapp}
                onChange={(e) => setForm((s) => ({ ...s, owner_whatsapp: e.target.value }))}
                inputMode="tel"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[color:var(--imob-navy)] px-5 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Enviando..." : "Enviar para aprovação"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Meus Imóveis (Captações)</div>
            <div className="mt-0.5 text-xs text-zinc-500">Seu estoque pessoal. Capte, atenda e acelere suas vendas.</div>
          </div>
          <button
            type="button"
            onClick={() => void loadCaptured()}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-[color:var(--imob-navy)] transition-all duration-300 hover:bg-zinc-50"
          >
            Atualizar
          </button>
        </div>

        {capturedError ? <div className="p-6 text-sm text-red-700">{capturedError}</div> : null}

        {capturedLoading ? (
          <div className="p-6 text-sm text-zinc-600">Carregando...</div>
        ) : capturedRows.length === 0 ? (
          <div className="p-10">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl bg-zinc-50 p-8 text-center ring-1 ring-zinc-200">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-3xl shadow-sm ring-1 ring-zinc-200">
                🏡
              </div>
              <div className="text-base font-semibold text-zinc-900">Pronto para sua próxima venda?</div>
              <div className="text-sm text-zinc-600">Seus imóveis aparecerão aqui!</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            {capturedRows.map((r) => {
              const title = String(r.data?.title ?? r.data?.name ?? "");
              const city = String(r.data?.city ?? r.data?.cidade ?? "");
              const neighborhood = String(r.data?.neighborhood ?? r.data?.bairro ?? r.data?.localidade ?? "");
              const loc = [neighborhood, city].filter(Boolean).join(" • ");
              const ownerWhatsapp = normalizeWhatsapp(
                String(r.data?.owner_whatsapp ?? r.data?.proprietario_whatsapp ?? r.data?.owner_phone ?? ""),
              );
              const beds = pickBeds(r.data);
              const baths = pickBaths(r.data);
              const priceLabel = formatCurrencyBRL(r.data?.price ?? r.data?.valor ?? null);

              return (
                <div
                  key={`${r.source}:${r.id}`}
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-[1px] hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-zinc-900">{title || "Sem título"}</div>
                      <div className="mt-1 truncate text-sm font-medium text-zinc-600">{loc || "Localização não informada"}</div>
                    </div>
                    <div className="shrink-0 rounded-full bg-[color:var(--imob-navy)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--imob-navy)]">
                      {r.source === "properties" ? "Imóvel" : "Empreendimento"}
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div className="text-sm text-zinc-600">Preço</div>
                    <div className="text-lg font-extrabold tracking-tight text-emerald-700">{priceLabel}</div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-700">
                    {beds != null ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1 ring-1 ring-zinc-200">
                        <span aria-hidden="true">🛏️</span>
                        <span className="font-semibold">{beds}</span>
                      </div>
                    ) : null}
                    {baths != null ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1 ring-1 ring-zinc-200">
                        <span aria-hidden="true">🚿</span>
                        <span className="font-semibold">{baths}</span>
                      </div>
                    ) : null}
                    {r.data?.area != null ? (
                      <div className="inline-flex items-center gap-2 rounded-full bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                        {String(r.data.area)} m²
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-medium text-zinc-500">
                      {ownerWhatsapp ? `WhatsApp do proprietário: ${ownerWhatsapp}` : "WhatsApp não informado"}
                    </div>
                    <Link
                      href={
                        ownerWhatsapp
                          ? `/corretor/whatsapp?phone=${encodeURIComponent(ownerWhatsapp)}`
                          : "/corretor/whatsapp"
                      }
                      className={
                        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all duration-300 " +
                        (ownerWhatsapp
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-zinc-100 text-zinc-400")
                      }
                      aria-disabled={!ownerWhatsapp}
                    >
                      <span aria-hidden="true">💬</span>
                      WhatsApp
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
