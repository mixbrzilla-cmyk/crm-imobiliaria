"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { formatBRLInput, formatCurrencyBRL, parseBRLInputToNumber } from "@/lib/brl";

type OpportunityStatus = "novo" | "avaliando" | "descartado" | "importado";

type OpportunityRow = {
  id: string;
  title: string;
  source_url: string | null;
  detected_price: number | null;
  status: OpportunityStatus;
  notes: string | null;
  created_at?: string;
};

type OpportunityForm = {
  title: string;
  source_url: string;
  detected_price: string;
  status: OpportunityStatus;
  notes: string;
};

type LeadImportForm = {
  full_name: string;
  phone: string;
  interest: string;
  source: string;
};

function sanitizePhone(input: string) {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function normalizeSourceFromUrl(url: string) {
  const lower = (url ?? "").trim().toLowerCase();
  if (!lower) return "gps";
  if (lower.includes("instagram") || lower.includes("facebook") || lower.includes("meta")) return "meta";
  if (lower.includes("google")) return "google";
  if (lower.includes("whats")) return "whatsapp";
  if (lower.includes("olx") || lower.includes("zap") || lower.includes("vivareal") || lower.includes("portal")) {
    return "portais";
  }
  return "gps";
}

function statusBadgeCls(status: OpportunityStatus) {
  if (status === "importado") return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
  if (status === "descartado") return "bg-slate-100 text-slate-600 ring-slate-200/70";
  if (status === "avaliando") return "bg-sky-50 text-sky-700 ring-sky-200/70";
  return "bg-red-50 text-red-700 ring-red-200/70";
}

export default function GpsOpportunitiesPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [rows, setRows] = useState<OpportunityRow[]>([]);

  const [form, setForm] = useState<OpportunityForm>({
    title: "",
    source_url: "",
    detected_price: "",
    status: "novo",
    notes: "",
  });

  const [importing, setImporting] = useState<OpportunityRow | null>(null);
  const [importForm, setImportForm] = useState<LeadImportForm>({
    full_name: "",
    phone: "",
    interest: "",
    source: "gps",
  });
  const [isImporting, setIsImporting] = useState(false);

  const load = useCallback(async () => {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const res = await (supabase as any)
        .from("gps_opportunities")
        .select("id, title, source_url, detected_price, status, notes, created_at")
        .order("created_at", { ascending: false });

      if (res.error) {
        setErrorMessage(res.error.message);
        setRows([]);
      } else {
        setRows((res.data ?? []) as OpportunityRow[]);
      }
    } catch {
      setErrorMessage("Não foi possível carregar o GPS de Captação agora.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createOpportunity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const title = form.title.trim();
    if (!title) {
      setErrorMessage("Informe o título/endereço da oportunidade.");
      return;
    }

    const payload = {
      id: crypto.randomUUID(),
      title,
      source_url: form.source_url.trim() ? form.source_url.trim() : null,
      detected_price: parseBRLInputToNumber(form.detected_price),
      status: form.status,
      notes: form.notes.trim() ? form.notes.trim() : null,
    };

    setIsSaving(true);

    try {
      const { error } = await (supabase as any).from("gps_opportunities").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        setIsSaving(false);
        return;
      }

      setForm({ title: "", source_url: "", detected_price: "", status: "novo", notes: "" });
      await load();
    } catch {
      setErrorMessage("Não foi possível salvar a oportunidade agora.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateOpportunityStatus(opportunityId: string, status: OpportunityStatus) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setRows((current) => current.map((r) => (r.id === opportunityId ? { ...r, status } : r)));

    try {
      const { error } = await (supabase as any)
        .from("gps_opportunities")
        .update({ status })
        .eq("id", opportunityId);

      if (error) {
        setErrorMessage(error.message);
        await load();
      }
    } catch {
      setErrorMessage("Não foi possível atualizar o status agora.");
      await load();
    }
  }

  function openImportModal(row: OpportunityRow) {
    setImporting(row);
    setImportForm({
      full_name: "",
      phone: "",
      interest: row.title,
      source: normalizeSourceFromUrl(row.source_url ?? ""),
    });
  }

  async function importAsLead() {
    if (!importing) return;

    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    const payload = {
      id: crypto.randomUUID(),
      full_name: importForm.full_name.trim(),
      phone: sanitizePhone(importForm.phone),
      interest: importForm.interest.trim() ? importForm.interest.trim() : null,
      stage: "recebido" as const,
      source: importForm.source.trim() ? importForm.source.trim() : "gps",
      assigned_broker_profile_id: null,
    };

    if (!payload.full_name || !payload.phone) {
      setErrorMessage("Informe Nome e Telefone para importar como lead.");
      return;
    }

    setIsImporting(true);

    try {
      const insertRes = await (supabase as any).from("leads").insert(payload);
      if (insertRes.error) {
        setErrorMessage(insertRes.error.message);
        setIsImporting(false);
        return;
      }

      await (supabase as any)
        .from("gps_opportunities")
        .update({ status: "importado" })
        .eq("id", importing.id);

      setImporting(null);
      setImportForm({ full_name: "", phone: "", interest: "", source: "gps" });
      await load();
    } catch {
      setErrorMessage("Não foi possível importar como lead agora.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">INTELIGÊNCIA</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">GPS de Captação</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Oportunidades detectadas externamente (links, preço estimado e importação rápida como lead).
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="text-sm font-semibold text-slate-900">Nova oportunidade</div>
        <form onSubmit={createOpportunity} className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <label className="text-xs font-semibold text-slate-600">Título/Endereço</label>
            <input
              value={form.title}
              onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
              placeholder="Ex.: Rua X, 123 - Apto 51"
            />
          </div>

          <div className="lg:col-span-4">
            <label className="text-xs font-semibold text-slate-600">Link da fonte</label>
            <input
              value={form.source_url}
              onChange={(e) => setForm((c) => ({ ...c, source_url: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
              placeholder="https://..."
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Valor detectado</label>
            <input
              value={form.detected_price}
              onChange={(e) =>
                setForm((c) => ({ ...c, detected_price: formatBRLInput(e.target.value) }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
              placeholder="R$ 0,00"
              inputMode="decimal"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-slate-600">Status</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((c) => ({ ...c, status: e.target.value as OpportunityStatus }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
            >
              <option value="novo">Novo</option>
              <option value="avaliando">Avaliando</option>
              <option value="descartado">Descartado</option>
              <option value="importado">Importado</option>
            </select>
          </div>

          <div className="lg:col-span-10">
            <label className="text-xs font-semibold text-slate-600">Observações</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
              placeholder="Ex.: andar alto, aceita permuta, precisa reforma..."
            />
          </div>

          <div className="lg:col-span-2 lg:flex lg:items-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_6px_12px_-6px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a34] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl bg-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-sm font-semibold text-slate-900">Oportunidades</div>
            <div className="mt-1 text-xs text-slate-500">GPS de captação (externo)</div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
          >
            Recarregar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Oportunidade
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Fonte
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Valor
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-slate-700">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-slate-700">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-5 py-10 text-sm text-slate-600" colSpan={5}>
                    Carregando...
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 text-sm">
                      <div className="font-semibold text-slate-900">{row.title}</div>
                      {row.notes ? (
                        <div className="mt-1 text-xs text-slate-500">{row.notes}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      {row.source_url ? (
                        <a
                          href={row.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-[#001f3f] underline decoration-[#ff0000]/40 underline-offset-4"
                        >
                          Abrir link
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {typeof row.detected_price === "number" ? formatCurrencyBRL(row.detected_price) : "-"}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusBadgeCls(
                            row.status,
                          )}`}
                        >
                          {row.status}
                        </span>
                        <select
                          value={row.status}
                          onChange={(e) =>
                            void updateOpportunityStatus(
                              row.id,
                              e.target.value as OpportunityStatus,
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
                        >
                          <option value="novo">novo</option>
                          <option value="avaliando">avaliando</option>
                          <option value="descartado">descartado</option>
                          <option value="importado">importado</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openImportModal(row)}
                        disabled={row.status === "importado"}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-[#ff0000] px-5 text-sm font-semibold text-white shadow-[0_6px_12px_-6px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Importar como Lead
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-10 text-sm text-slate-600" colSpan={5}>
                    Nenhuma oportunidade cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {importing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-6">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.45)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">IMPORTAR</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">Importar como Lead</div>
                <div className="mt-2 text-sm text-slate-600">{importing.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setImporting(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-600">Nome do lead</label>
                <input
                  value={importForm.full_name}
                  onChange={(e) => setImportForm((c) => ({ ...c, full_name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
                  placeholder="Ex.: João Silva"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">WhatsApp</label>
                <input
                  value={importForm.phone}
                  onChange={(e) => setImportForm((c) => ({ ...c, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Interesse</label>
                <input
                  value={importForm.interest}
                  onChange={(e) => setImportForm((c) => ({ ...c, interest: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Origem</label>
                <input
                  value={importForm.source}
                  onChange={(e) => setImportForm((c) => ({ ...c, source: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-all focus:border-[#001f3f] focus:ring-2 focus:ring-[#ff0000]/20"
                  placeholder="gps/meta/google/whatsapp/portais/landing"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => setImporting(null)}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void importAsLead()}
                disabled={isImporting}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#001f3f] px-6 text-sm font-semibold text-white shadow-[0_6px_12px_-6px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a34] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting ? "Importando..." : "Importar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
