"use client";

import { useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type FormState = {
  full_name: string;
  whatsapp: string;
  creci: string;
};

export default function CadastroPage() {
  const [form, setForm] = useState<FormState>({
    full_name: "",
    whatsapp: "",
    creci: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();

      if (!supabase) {
        setErrorMessage(
          "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
        return;
      }

      const id = crypto.randomUUID();

      const { error } = await supabase.from("profiles").insert({
        id,
        full_name: form.full_name.trim(),
        whatsapp: form.whatsapp.trim(),
        creci: form.creci.trim(),
        status: "pendente",
      });

      if (error) {
        if (/null value in column\s+"id"/i.test(error.message)) {
          setErrorMessage(
            "Erro ao enviar cadastro: o sistema não conseguiu gerar um identificador. Tente novamente.",
          );
          return;
        }

        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Cadastro enviado! Aguarde a aprovação do administrador");
      setForm({ full_name: "", whatsapp: "", creci: "" });
    } catch {
      setErrorMessage("Não foi possível enviar seu cadastro. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1e3a8a]">
            Cadastro
          </h1>
          <p className="text-sm text-zinc-600">
            Preencha seus dados para solicitar acesso ao portal.
          </p>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#1e3a8a]">Nome completo</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.full_name}
              onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
              name="full_name"
              required
              autoComplete="name"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#1e3a8a]">WhatsApp</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.whatsapp}
              onChange={(e) => setForm((s) => ({ ...s, whatsapp: e.target.value }))}
              name="whatsapp"
              required
              autoComplete="tel"
              inputMode="tel"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#1e3a8a]">CRECI</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-zinc-900 outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20"
              value={form.creci}
              onChange={(e) => setForm((s) => ({ ...s, creci: e.target.value }))}
              name="creci"
              required
            />
          </label>

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-[#dc2626] px-5 text-base font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Enviando..." : "Enviar cadastro"}
          </button>
        </form>
      </div>
    </div>
  );
}
