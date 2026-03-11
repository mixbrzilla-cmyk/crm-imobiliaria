"use client";

import { useEffect, useMemo, useState } from "react";

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

function normalizeWhatsapp(v: string) {
  return String(v ?? "").replace(/\D+/g, "").trim();
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
          [propertiesAssignColumn]: brokerId,
        };

        const payloadAttempts: Array<any> = [payloadBase, { ...payloadBase }];
        delete payloadAttempts[1].owner_name;

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
          const code = (res.error as any)?.code;
          const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
          if (!isOwnerNameMissing && !isSchemaMismatch) break;
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
          [developmentsAssignColumn]: brokerId,
        };

        const payloadAttempts: Array<any> = [payloadBase, { ...payloadBase }];
        delete payloadAttempts[1].owner_name;

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
          const code = (res.error as any)?.code;
          const isSchemaMismatch = code === "PGRST204" || code === "PGRST301";
          if (!isOwnerNameMissing && !isSchemaMismatch) break;
        }

        if (lastError) {
          setErrorMessage(lastError.message);
          setIsSaving(false);
          return;
        }
      }

      setSuccessMessage("Captação enviada com sucesso. Já aparece no painel do Boss.");
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
        <div className="text-sm font-semibold text-[#1e3a8a]">Meu Inventário (Captação)</div>
        <div className="text-xs text-zinc-500">
          Cadastre novos imóveis/empreendimentos no seu nome. O Boss vê instantaneamente no Admin.
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
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
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
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                required
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">Cidade</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                value={form.city}
                onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">Bairro / Localidade</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                value={form.neighborhood}
                onChange={(e) => setForm((s) => ({ ...s, neighborhood: e.target.value }))}
              />
            </label>

            {form.mode === "imovel" ? (
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-zinc-600">Valor (R$)</span>
                <input
                  className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                  value={form.price}
                  onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))}
                  inputMode="decimal"
                />
              </label>
            ) : (
              <div />
            )}

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">Nome do Proprietário</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                value={form.owner_name}
                onChange={(e) => setForm((s) => ({ ...s, owner_name: e.target.value }))}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-600">WhatsApp do Proprietário</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
                value={form.owner_whatsapp}
                onChange={(e) => setForm((s) => ({ ...s, owner_whatsapp: e.target.value }))}
                inputMode="tel"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1e3a8a] px-5 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Enviando..." : "Enviar para aprovação"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
