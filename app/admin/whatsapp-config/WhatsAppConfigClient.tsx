"use client";

import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type SettingsRow = {
  id?: string;
  instance_id: string | null;
  token: string | null;
  client_key: string | null;
  webhook_url: string | null;
  created_at?: string;
};

type FormState = {
  instance_id: string;
  token: string;
  client_key: string;
  webhook_url: string;
};

export default function WhatsAppConfigClient() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const SETTINGS_ID = "singleton";

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [supportsTable, setSupportsTable] = useState(true);

  const [form, setForm] = useState<FormState>({
    instance_id: "",
    token: "",
    client_key: "",
    webhook_url: "",
  });

  async function load() {
    setIsLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

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
        .select("id, instance_id, token, client_key, webhook_url, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (res.error) {
        console.log("DEBUG SUPABASE:", res.error);
        throw res.error;
      }

      const row = (res.data ?? null) as SettingsRow | null;
      if (row) {
        setForm({
          instance_id: row.instance_id ?? "",
          token: row.token ?? "",
          client_key: row.client_key ?? "",
          webhook_url: row.webhook_url ?? "",
        });
      } else {
        setInfoMessage("Aguardando configuração da Z-API. Preencha as credenciais quando estiverem disponíveis.");
      }

      setSupportsTable(true);
    } catch (e: any) {
      const code = e?.code;
      if (code === "42P01" || code === "PGRST204" || code === "PGRST301") {
        setSupportsTable(false);
        setInfoMessage(
          "Infra do WhatsApp pendente no Supabase (tabelas ainda não criadas). Execute o SQL de infraestrutura para habilitar.",
        );
      } else {
        setSupportsTable(false);
        setInfoMessage(
          "Infra do WhatsApp pendente no Supabase (tabelas ainda não criadas). Execute o SQL de infraestrutura para habilitar.",
        );
      }
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
        instance_id: form.instance_id.trim() ? form.instance_id.trim() : null,
        token: form.token.trim() ? form.token.trim() : null,
        client_key: form.client_key.trim() ? form.client_key.trim() : null,
        webhook_url: form.webhook_url.trim() ? form.webhook_url.trim() : null,
      };

      if (!payload.instance_id || !payload.token) {
        setErrorMessage("Preencha instance_id e token.");
        setIsSaving(false);
        return;
      }

      const validateRes = await fetch("/api/whatsapp/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: payload.instance_id, token: payload.token }),
      });
      const validateJson = await validateRes.json().catch(() => null);
      if (!validateRes.ok || !validateJson?.ok) {
        setErrorMessage(validateJson?.error ?? "Z-API não conectada. Verifique instance_id e token.");
        setIsSaving(false);
        return;
      }

      const res = await (supabase as any)
        .from("whatsapp_settings")
        .upsert({ id: SETTINGS_ID, ...payload }, { onConflict: "id" });

      if (res.error) {
        console.log("DEBUG SUPABASE:", res.error);
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
          Configure a instância oficial. O webhook deve apontar para{" "}
          <span className="font-semibold">/api/whatsapp/webhook</span>.
        </p>
      </header>

      {infoMessage ? (
        <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900 ring-1 ring-amber-200/70">
          {infoMessage}
        </div>
      ) : null}

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
            <span className="text-xs font-semibold tracking-wide text-slate-600">Webhook URL</span>
            <input
              value={form.webhook_url}
              onChange={(e) => setForm((s) => ({ ...s, webhook_url: e.target.value }))}
              placeholder="https://SEU_DOMINIO.com/api/whatsapp/webhook"
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
