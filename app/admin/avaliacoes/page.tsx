"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Calendar,
  FileDown,
  Link as LinkIcon,
  MapPin,
  Plus,
  RefreshCw,
  Send,
  Tag,
} from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";
import { formatBRLInput, formatCurrencyBRL, parseBRLInputToNumber } from "@/lib/brl";

type AppraisalStatus = "agendada" | "realizada" | "laudo_emitido" | "publicado";

type AppraisalRow = {
  id: string;
  client_name: string | null;
  address: string;
  neighborhood: string | null;
  city: string | null;
  scheduled_at: string | null;
  status: AppraisalStatus;
  area_m2: number | null;
  condition: string | null;
  suggested_price: number | null;
  notes: string | null;
  video_call_link: string | null;
  published_property_id: string | null;
  created_at?: string;
};

type FormState = {
  client_name: string;
  address: string;
  neighborhood: string;
  city: string;
  scheduled_at: string;
  status: AppraisalStatus;
  area_m2: string;
  condition: string;
  suggested_price: string;
  notes: string;
  video_call_link: string;
};

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function safeText(value: string | null | undefined) {
  return (value ?? "").toString();
}

function buildLaudoHtml(appraisal: AppraisalRow) {
  const area = appraisal.area_m2 != null ? `${appraisal.area_m2} m²` : "-";
  const price = appraisal.suggested_price != null ? formatCurrencyBRL(appraisal.suggested_price) : "-";
  const scheduled = appraisal.scheduled_at ? new Date(appraisal.scheduled_at).toLocaleString("pt-BR") : "-";

  const css = `
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #0f172a; }
    .top { display:flex; justify-content: space-between; align-items:flex-start; gap: 24px; }
    .brand { color:#001f3f; font-weight: 800; letter-spacing: 0.06em; font-size: 12px; }
    h1 { margin: 10px 0 0; font-size: 22px; color: #001f3f; }
    .sub { margin-top: 6px; font-size: 12px; color:#475569; }
    .badge { display:inline-block; padding: 6px 10px; border-radius: 999px; background:#ff0000; color:white; font-weight:700; font-size:11px; }
    .grid { margin-top: 18px; display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 1px solid rgba(148,163,184,0.55); border-radius: 14px; padding: 14px; background: #ffffff; }
    .label { font-size: 11px; color:#64748b; font-weight: 700; letter-spacing: 0.06em; }
    .value { margin-top: 6px; font-size: 14px; color:#0f172a; font-weight: 600; }
    .notes { margin-top: 12px; }
    .divider { height: 1px; background: rgba(148,163,184,0.4); margin: 18px 0; }
    .footer { margin-top: 18px; font-size: 11px; color:#64748b; }
  `;

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Laudo de Avaliação</title>
        <style>${css}</style>
      </head>
      <body>
        <div class="top">
          <div>
            <div class="brand">AVALIAÇÃO TÉCNICA</div>
            <h1>Laudo de Vistoria e Avaliação</h1>
            <div class="sub">Relatório gerado pelo CRM • ${new Date().toLocaleString("pt-BR")}</div>
          </div>
          <div class="badge">CONFIDENCIAL</div>
        </div>

        <div class="divider"></div>

        <div class="grid">
          <div class="card">
            <div class="label">CLIENTE</div>
            <div class="value">${safeText(appraisal.client_name) || "-"}</div>
          </div>
          <div class="card">
            <div class="label">AGENDAMENTO</div>
            <div class="value">${scheduled}</div>
          </div>
          <div class="card">
            <div class="label">ENDEREÇO</div>
            <div class="value">${safeText(appraisal.address)}</div>
            <div class="sub">${safeText(appraisal.neighborhood) || "-"} • ${safeText(appraisal.city) || "-"}</div>
          </div>
          <div class="card">
            <div class="label">MÉTRAGEM</div>
            <div class="value">${area}</div>
          </div>
          <div class="card">
            <div class="label">ESTADO / CONSERVAÇÃO</div>
            <div class="value">${safeText(appraisal.condition) || "-"}</div>
          </div>
          <div class="card">
            <div class="label">VALOR SUGERIDO</div>
            <div class="value">${price}</div>
          </div>
        </div>

        <div class="notes">
          <div class="card">
            <div class="label">OBSERVAÇÕES</div>
            <div class="value" style="white-space: pre-wrap; font-weight: 500;">${safeText(appraisal.notes) || "-"}</div>
          </div>
        </div>

        <div class="footer">
          Este laudo é informativo e deve ser validado pela equipe técnica/jurídica antes de publicação.
        </div>
      </body>
    </html>
  `;

  return html;
}

export default function AvaliacoesAdminPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [rows, setRows] = useState<AppraisalRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    client_name: "",
    address: "",
    neighborhood: "",
    city: "",
    scheduled_at: "",
    status: "agendada",
    area_m2: "",
    condition: "",
    suggested_price: "",
    notes: "",
    video_call_link: "",
  });

  const load = useCallback(async () => {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setRows([]);
      return;
    }

    setIsLoading(true);

    try {
      const res = await (supabase as any)
        .from("property_appraisals")
        .select(
          "id, client_name, address, neighborhood, city, scheduled_at, status, area_m2, condition, suggested_price, notes, video_call_link, published_property_id, created_at",
        )
        .order("created_at", { ascending: false });

      if (res.error) {
        setErrorMessage(res.error.message);
        setRows([]);
      } else {
        setRows((res.data ?? []) as AppraisalRow[]);
      }
    } catch {
      setErrorMessage("Não foi possível carregar as avaliações agora.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addAppraisal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        id: crypto.randomUUID(),
        client_name: form.client_name.trim() || null,
        address: form.address.trim(),
        neighborhood: form.neighborhood.trim() || null,
        city: form.city.trim() || null,
        scheduled_at: form.scheduled_at,
        status: form.status,
        area_m2: parseOptionalNumber(form.area_m2),
        condition: form.condition.trim() || null,
        suggested_price: parseBRLInputToNumber(form.suggested_price),
        notes: form.notes.trim() || null,
        video_call_link: form.video_call_link.trim() || null,
        published_property_id: null,
      };

      const { error } = await (supabase as any).from("property_appraisals").insert(payload);
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setForm({
        client_name: "",
        address: "",
        neighborhood: "",
        city: "",
        scheduled_at: "",
        status: "agendada",
        area_m2: "",
        condition: "",
        suggested_price: "",
        notes: "",
        video_call_link: "",
      });

      await load();
    } catch {
      setErrorMessage("Não foi possível salvar a avaliação.");
    } finally {
      setIsSaving(false);
    }
  }

  function exportPdf(appraisal: AppraisalRow) {
    const html = buildLaudoHtml(appraisal);
    const win = window.open("", "_blank");
    if (!win) {
      setErrorMessage("Pop-up bloqueado. Permita pop-ups para gerar o PDF.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();

    const tryPrint = () => {
      win.focus();
      win.print();
    };

    setTimeout(tryPrint, 250);
  }

  async function publishToCatalog(appraisal: AppraisalRow) {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (appraisal.published_property_id) return;

    setPublishingId(appraisal.id);

    try {
      const propertyId = crypto.randomUUID();
      const title = `Avaliação • ${appraisal.address}`;
      const descriptionParts = [
        appraisal.condition ? `Estado: ${appraisal.condition}` : null,
        appraisal.notes ? `Observações: ${appraisal.notes}` : null,
      ].filter(Boolean);

      const payload = {
        id: propertyId,
        title,
        property_type: "Apartamento",
        purpose: "venda",
        price: appraisal.suggested_price,
        neighborhood: appraisal.neighborhood,
        city: appraisal.city,
        area_m2: appraisal.area_m2,
        status: "disponivel",
        description: descriptionParts.length > 0 ? descriptionParts.join("\n") : null,
      };

      const insertRes = await (supabase as any).from("properties").insert(payload);
      if (insertRes.error) {
        setErrorMessage(insertRes.error.message);
        return;
      }

      const updateRes = await (supabase as any)
        .from("property_appraisals")
        .update({ status: "publicado", published_property_id: propertyId })
        .eq("id", appraisal.id);

      if (updateRes.error) {
        setErrorMessage(updateRes.error.message);
        return;
      }

      await load();
    } catch {
      setErrorMessage("Não foi possível publicar no catálogo.");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
          AVALIAÇÃO • VISTORIA • LAUDO
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Avaliações</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Agenda de vistorias técnicas e laudos com exportação para PDF. Publicação direta no catálogo.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Nova vistoria</div>
                <div className="mt-1 text-xs text-slate-500">Agende e registre o laudo técnico.</div>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
            </div>

            <form onSubmit={addAppraisal} className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Cliente (opcional)</span>
                <input
                  value={form.client_name}
                  onChange={(e) => setForm((s) => ({ ...s, client_name: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  placeholder="Nome"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Endereço</span>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.address}
                    onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                    className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Rua / número"
                    required
                  />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Bairro</span>
                  <input
                    value={form.neighborhood}
                    onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Bairro"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Cidade</span>
                  <input
                    value={form.city}
                    onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="Cidade"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Agendamento (opcional)</span>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm((s) => ({ ...s, scheduled_at: e.target.value }))}
                    className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Metragem (m²)</span>
                  <input
                    value={form.area_m2}
                    onChange={(e) => setForm((s) => ({ ...s, area_m2: e.target.value }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="0"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Valor sugerido</span>
                  <input
                    value={form.suggested_price}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, suggested_price: formatBRLInput(e.target.value) }))
                    }
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="R$ 0,00"
                    inputMode="decimal"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Estado / conservação</span>
                <input
                  value={form.condition}
                  onChange={(e) => setForm((s) => ({ ...s, condition: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  placeholder="Ex: ótimo / precisa reforma"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Link de vídeo-chamada</span>
                <div className="relative">
                  <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.video_call_link}
                    onChange={(e) => setForm((s) => ({ ...s, video_call_link: e.target.value }))}
                    className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                    placeholder="https://meet..."
                  />
                </div>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-wide text-slate-600">Observações</span>
                <input
                  value={form.notes}
                  onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                  className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  placeholder="Notas técnicas"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as AppraisalStatus }))}
                    className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-[#001f3f]/15"
                  >
                    <option value="agendada">Agendada</option>
                    <option value="realizada">Realizada</option>
                    <option value="laudo_emitido">Laudo emitido</option>
                    <option value="publicado">Publicado</option>
                  </select>
                </label>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Ação</span>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-5 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    {isSaving ? "Salvando..." : "Adicionar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Agenda & Laudos</div>
                <div className="mt-1 text-xs text-slate-500">Exportar PDF e publicar no catálogo.</div>
              </div>
              <div className="text-xs text-slate-500">{isLoading ? "Atualizando..." : `${rows.length} itens`}</div>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {rows.length > 0 ? (
                rows.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{r.address}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {r.neighborhood ?? "-"} • {r.city ?? "-"} • Status: {r.status}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          Cliente: {r.client_name ?? "-"} • Agendado: {r.scheduled_at ? new Date(r.scheduled_at).toLocaleString("pt-BR") : "-"}
                        </div>
                      </div>
                      <span className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                        {r.suggested_price != null ? formatCurrencyBRL(r.suggested_price) : "-"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportPdf(r)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-3 text-xs font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:bg-[#001a33]"
                      >
                        <FileDown className="h-4 w-4" />
                        Exportar PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => void publishToCatalog(r)}
                        disabled={publishingId === r.id || !!r.published_property_id}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#ff0000] px-3 text-xs font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                        {r.published_property_id ? "Publicado" : publishingId === r.id ? "Publicando..." : "Publicar no Catálogo"}
                      </button>

                      {r.video_call_link ? (
                        <a
                          href={r.video_call_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-100"
                        >
                          <LinkIcon className="h-4 w-4" />
                          Chamada
                        </a>
                      ) : null}

                      <span className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                        <Tag className="mr-2 h-4 w-4 text-slate-400" />
                        {r.area_m2 != null ? `${r.area_m2} m²` : "-"}
                      </span>

                      <span className="inline-flex h-9 items-center justify-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                        <MapPin className="mr-2 h-4 w-4 text-slate-400" />
                        {r.condition ?? "-"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-slate-50 px-5 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                  Nenhuma avaliação cadastrada.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
