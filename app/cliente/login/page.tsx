"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Mode = "cpf" | "email";

export default function ClienteLoginPage() {
  const [mode, setMode] = useState<Mode>("cpf");
  const [cpfOrEmail, setCpfOrEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(null);
    setOkMessage(null);
  }, [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setOkMessage(null);

    try {
      const res = await fetch("/api/cliente/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          cpf: mode === "cpf" ? cpfOrEmail : null,
          email: mode === "email" ? cpfOrEmail : null,
          phone,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMessage(String(data?.error ?? "Não foi possível autenticar."));
        setIsLoading(false);
        return;
      }

      setOkMessage("Acesso liberado. Redirecionando...");
      window.location.href = "/cliente/dashboard";
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Falha inesperada.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-lg px-6 py-10">
        <div className="rounded-3xl bg-white p-6 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70">
          <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">ÁREA DO CLIENTE</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Meu Dashboard</h1>
          <div className="mt-2 text-sm text-slate-600">
            Acesse suas preferências e sugestões de imóveis.
          </div>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("cpf")}
                className={
                  "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ring-1 transition-all duration-300 " +
                  (mode === "cpf"
                    ? "bg-slate-900 text-white ring-slate-900/10"
                    : "bg-white text-slate-800 ring-slate-200/70 hover:bg-slate-50")
                }
              >
                CPF
              </button>
              <button
                type="button"
                onClick={() => setMode("email")}
                className={
                  "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ring-1 transition-all duration-300 " +
                  (mode === "email"
                    ? "bg-slate-900 text-white ring-slate-900/10"
                    : "bg-white text-slate-800 ring-slate-200/70 hover:bg-slate-50")
                }
              >
                E-mail
              </button>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide text-slate-600">
                {mode === "cpf" ? "CPF" : "E-mail"}
              </span>
              <input
                value={cpfOrEmail}
                onChange={(e) => setCpfOrEmail(e.target.value)}
                className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                placeholder={mode === "cpf" ? "Digite seu CPF" : "Digite seu e-mail"}
                inputMode={mode === "cpf" ? "numeric" : "email"}
                required
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide text-slate-600">Telefone (WhatsApp)</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10"
                placeholder="(11) 9xxxx-xxxx"
                inputMode="tel"
                required
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200/70">
                {errorMessage}
              </div>
            ) : null}

            {okMessage ? (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200/70">
                {okMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-18px_rgba(16,185,129,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Seus dados ficam restritos ao seu cadastro.</span>
              <Link href="/" className="font-semibold text-slate-700 hover:text-slate-900">
                Voltar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
