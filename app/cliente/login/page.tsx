"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

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
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage: "linear-gradient(180deg, #050815 0%, #07152F 55%, #050815 100%)",
      }}
    >
      <div className="mx-auto w-full max-w-lg px-6 py-10">
        <div className="rounded-3xl bg-[radial-gradient(circle_at_top,white,rgba(241,245,249,0.7))] p-6 shadow-2xl ring-1 ring-slate-200/70">
          <div className="flex items-center gap-3">
            <img
              src="https://imobmoderna.com.br/wp-content/uploads/2026/03/Sem-Titulo-2-1024x1024-1.png"
              alt="CRM Imobiliária Moderna"
              className="h-11 w-11 rounded-2xl bg-white object-cover ring-1 ring-slate-200/70"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">CRM Imobiliária Moderna</div>
              <div className="truncate text-xs font-semibold tracking-[0.14em] text-slate-600">DASHBOARD DO CLIENTE</div>
            </div>
          </div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight" style={{ color: "#2B3674" }}>
            Meu Dashboard
          </h1>
          <div className="mt-2 text-sm text-slate-600">
            Ambiente seguro e criptografado. Seus dados estão protegidos e são utilizados apenas para a personalização do
            seu atendimento imobiliário.
          </div>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("cpf")}
                className={
                  "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold ring-1 transition-all duration-300 " +
                  (mode === "cpf"
                    ? "bg-[#2B3674] text-white ring-black/10"
                    : "bg-white text-slate-800 ring-[#2B3674]/20 hover:bg-slate-50")
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
                    ? "bg-[#2B3674] text-white ring-black/10"
                    : "bg-white text-slate-800 ring-[#2B3674]/20 hover:bg-slate-50")
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
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2B3674] px-5 text-sm font-semibold text-white shadow-[0_12px_26px_-18px_rgba(2,6,23,0.65)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#344196] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                "Entrando..."
              ) : (
                <>
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  Entrar
                </>
              )}
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
