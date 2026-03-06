"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type SettingsRow = {
  id?: string;
  api_base_url: string | null;
  instance_id: string | null;
  token: string | null;
  client_key: string | null;
  official_number?: string | null;
  created_at?: string;
};

type FormState = {
  api_base_url: string;
  instance_id: string;
  token: string;
  client_key: string;
  official_number: string;
};

export default function WhatsAppConfigPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [supportsTable, setSupportsTable] = useState(true);

  const [form, setForm] = useState<FormState>({
    api_base_url: "https://api.z-api.io",
    instance_id: "",
    token: "",
    client_key: "",
    official_number: "",
  });

  async function load() {
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
      const res = await supabase
        .from("whatsapp_settings")
        .select("api_base_url, instance_id, token, client_key, official_number, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (res.error) throw res.error;

      const row = (res.data ?? null) as SettingsRow | null;
      if (row) {
        setForm({
          api_base_url: row.api_base_url ?? "https://api.z-api.io",
          instance_id: row.instance_id ?? "",
          token: row.token ?? "",
          client_key: row.client_key ?? "",
          official_number: row.official_number ?? "",
        });
      }

      setSupportsTable(true);
    } catch {
      setSupportsTable(false);
      setErrorMessage(
        "Tabela whatsapp_settings não encontrada. Crie a tabela no Supabase para salvar a configuração.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function save() {
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (!supportsTable) {
      setErrorMessage("Tabela whatsapp_settings não existe. Não é possível salvar.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        api_base_url: form.api_base_url.trim() ? form.api_base_url.trim() : null,
        instance_id: form.instance_id.trim() ? form.instance_id.trim() : null,
        token: form.token.trim() ? form.token.trim() : null,
        client_key: form.client_key.trim() ? form.client_key.trim() : null,
        official_number: form.official_number.trim() ? form.official_number.trim() : null,
      };

      const res = await (supabase as any).from("whatsapp_settings").insert({
        id: crypto.randomUUID(),
        ...payload,
      });

      if (res.error) {
        setErrorMessage(res.error.message);
        setIsSaving(false);
        return;
      }

      setIsSaving(false);
      await load();
    } catch {
      setErrorMessage("Não foi possível salvar a configuração agora.");
      setIsSaving(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 0);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">WHATSAPP BUSINESS</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Configuração Z-API</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Configure a instância oficial. O webhook deve apontar para <span className="font-semibold">/api/whatsapp/webhook</span>.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Credenciais</div>
            <div className="mt-1 text-xs text-slate-500">Esses dados ficam no Supabase (tabela whatsapp_settings).</div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
          >
            Recarregar
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-semibold tracking-wide text-slate-600">API Base URL</span>
            <input
              value={form.api_base_url}
              onChange={(e) => setForm((s) => ({ ...s, api_base_url: e.target.value }))}
              placeholder="https://api.z-api.io"
              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
              disabled={isLoading}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wide text-slate-600">Instância</span>
            <input
              value={form.instance_id}
              onChange={(e) => setForm((s) => ({ ...s, instance_id: e.target.value }))}
              placeholder="INSTANCE_ID"
              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
              disabled={isLoading}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-wide text-slate-600">Token</span>
            <input
              value={form.token}
              onChange={(e) => setForm((s) => ({ ...s, token: e.target.value }))}
              placeholder="TOKEN"
              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
              disabled={isLoading}
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-semibold tracking-wide text-slate-600">ClientKey (validação webhook)</span>
            <input
              value={form.client_key}
              onChange={(e) => setForm((s) => ({ ...s, client_key: e.target.value }))}
              placeholder="CLIENT_KEY"
              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
              disabled={isLoading}
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-semibold tracking-wide text-slate-600">Número Oficial (WhatsApp da empresa)</span>
            <input
              value={form.official_number}
              onChange={(e) => setForm((s) => ({ ...s, official_number: e.target.value }))}
              placeholder="Ex: 5591999999999"
              className="h-11 rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
              disabled={isLoading}
            />
          </label>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => void save()}
            disabled={isSaving || isLoading || !supportsTable}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-[#ff0000] px-6 text-sm font-semibold text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.20)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
        <div className="text-sm font-semibold text-slate-900">Webhook</div>
        <div className="mt-2 text-sm text-slate-700">
          Configure no painel da Z-API:
          <div className="mt-2 rounded-xl bg-slate-50 px-4 py-3 font-mono text-xs text-slate-800 ring-1 ring-slate-200/70">
            POST https://SEU_DOMINIO.com/api/whatsapp/webhook
          </div>
        </div>
      </section>
    </div>
  );
}
