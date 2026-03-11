"use client";

import { useState } from "react";

import Image from "next/image";

import { getSupabaseClient } from "@/lib/supabaseClient";

type FormState = {
  email: string;
  password: string;
  full_name: string;
  whatsapp: string;
  creci: string;
  cnai: string;
};

export default function CadastroPage() {
  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    full_name: "",
    whatsapp: "",
    creci: "",
    cnai: "",
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

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
      });

      if (authError) {
        setErrorMessage(authError.message);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        setErrorMessage(
          "Não foi possível criar sua conta agora. Tente novamente em instantes.",
        );
        return;
      }

      const cnai = form.cnai.trim();

      const { error } = await (supabase as any).from("profiles").insert({
        id: userId,
        email: form.email.trim().toLowerCase(),
        full_name: form.full_name.trim(),
        whatsapp: form.whatsapp.trim(),
        creci: form.creci.trim(),
        role: "broker",
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

      if (cnai) {
        try {
          const up = await (supabase as any).from("profiles").update({ cnai }).eq("id", userId);
          if (up?.error) {
            // ignore
          }
        } catch {
          // ignore
        }
      }

      setSuccessMessage("Cadastro enviado! Aguarde a aprovação do administrador");
      setForm({ email: "", password: "", full_name: "", whatsapp: "", creci: "", cnai: "" });
    } catch {
      setErrorMessage("Não foi possível enviar seu cadastro. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="relative h-16 w-56 sm:h-20 sm:w-64">
            <Image
              src="/imobiliaria-moderna-logo.png"
              alt="Imobiliária Moderna"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Cadastro de Corretor</h1>
            <p className="mt-2 text-sm text-slate-600">
              Preencha seus dados para solicitar acesso ao portal.
            </p>
          </div>
        </header>

        <form onSubmit={onSubmit} className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200/70 sm:p-8">
          <div className="grid grid-cols-1 gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">E-mail</span>
              <input
                className="h-12 rounded-xl bg-white px-4 text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#1e3a8a]/25"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">Senha</span>
              <input
                className="h-12 rounded-xl bg-white px-4 text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#1e3a8a]/25"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">Nome completo</span>
              <input
                className="h-12 rounded-xl bg-white px-4 text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#1e3a8a]/25"
                value={form.full_name}
                onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))}
                name="full_name"
                required
                autoComplete="name"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">WhatsApp</span>
              <input
                className="h-12 rounded-xl bg-white px-4 text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#1e3a8a]/25"
                value={form.whatsapp}
                onChange={(e) => setForm((s) => ({ ...s, whatsapp: e.target.value }))}
                name="whatsapp"
                required
                autoComplete="tel"
                inputMode="tel"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">CRECI</span>
              <input
                className="h-12 rounded-xl bg-white px-4 text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#1e3a8a]/25"
                value={form.creci}
                onChange={(e) => setForm((s) => ({ ...s, creci: e.target.value }))}
                name="creci"
                required
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">CNAI (opcional)</span>
              <input
                className="h-12 rounded-xl bg-white px-4 text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all focus:ring-2 focus:ring-[#1e3a8a]/25"
                value={form.cnai}
                onChange={(e) => setForm((s) => ({ ...s, cnai: e.target.value }))}
                name="cnai"
                inputMode="numeric"
                placeholder="Ex: 123456"
              />
            </label>
          </div>

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
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#dc2626] px-5 text-base font-semibold text-white shadow-[0_10px_26px_-18px_rgba(220,38,38,0.75)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#c81e1e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Enviando..." : "Enviar cadastro"}
          </button>
        </form>
      </div>
    </div>
  );
}
