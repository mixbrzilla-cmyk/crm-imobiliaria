"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type FormState = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setErrorMessage(
          "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      try {
        const userId = data.user?.id ?? "";
        if (userId) {
          document.cookie = `crm_user_id=${encodeURIComponent(userId)}; Path=/; Max-Age=2592000; SameSite=Lax`;
        }
      } catch {
        // ignore
      }

      const email = data.user?.email?.toLowerCase() ?? "";
      const ownerEmail = (
        process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "imobmoderna2024@gmail.com"
      ).toLowerCase();

      if (email === ownerEmail) {
        router.push("/admin");
        return;
      }

      router.push("/corretor");
    } catch {
      setErrorMessage("Não foi possível entrar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-center">
            <Image
              src="/imobiliaria-moderna-logo.png"
              alt="Imobiliária Moderna"
              width={240}
              height={80}
              priority
              className="h-14 w-auto"
            />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--imob-navy)]">Entrar</h1>
          <p className="text-sm text-zinc-600">
            Acesse o CRM com seu e-mail e senha.
          </p>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[color:var(--imob-navy)]">E-mail</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-zinc-900 outline-none focus:border-[color:var(--imob-navy)] focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[color:var(--imob-navy)]">Senha</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-4 text-zinc-900 outline-none focus:border-[color:var(--imob-navy)] focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-[color:var(--imob-navy)] px-5 text-base font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>

          <div className="text-sm text-zinc-600">
            Não tem conta?{" "}
            <Link className="font-semibold text-[color:var(--imob-red)] hover:underline" href="/cadastro">
              Solicitar acesso
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
