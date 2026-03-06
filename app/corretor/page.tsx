"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  status: string | null;
  role: string | null;
};

export default function CorretorHomePage() {
  const supabase = getSupabaseClient();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void (async () => {
        setIsLoading(true);
        setErrorMessage(null);

        if (!supabase) {
          setErrorMessage(
            "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
          );
          setProfile(null);
          setIsLoading(false);
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          setErrorMessage(userError.message);
          setIsLoading(false);
          return;
        }

        if (!user) {
          setErrorMessage("Você precisa entrar para acessar essa área.");
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, status, role")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          setErrorMessage(error.message);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        setProfile((data as Profile | null) ?? null);
        setIsLoading(false);
      })();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  async function sair() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex flex-col">
            <div className="text-sm font-semibold text-[#1e3a8a]">Área do Corretor</div>
            <div className="text-xs text-zinc-500">CRM Operacional</div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/corretor/clientes"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-[#1e3a8a] hover:bg-zinc-50"
            >
              Meus Clientes
            </Link>
            <button
              type="button"
              onClick={() => void sair()}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#dc2626] px-4 text-sm font-semibold text-white hover:opacity-95"
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {isLoading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Carregando...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {errorMessage} {errorMessage.includes("entrar") ? (
              <span>
                <Link className="ml-2 font-semibold underline" href="/login">
                  Ir para login
                </Link>
              </span>
            ) : null}
          </div>
        ) : profile && profile.status !== "ativo" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <div className="text-lg font-semibold text-[#1e3a8a]">Acesso pendente</div>
            <div className="mt-1 text-sm text-zinc-700">
              Seu cadastro foi recebido e está aguardando aprovação do dono.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 md:col-span-2">
              <div className="text-lg font-semibold text-[#1e3a8a]">
                Bem-vindo{profile?.full_name ? `, ${profile.full_name}` : ""}
              </div>
              <div className="mt-1 text-sm text-zinc-600">
                Aqui você vai gerenciar seus clientes e o funil de vendas.
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/corretor/clientes"
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-[#1e3a8a] px-5 text-sm font-semibold text-white hover:opacity-95"
                >
                  Abrir Kanban de Clientes
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="text-sm font-medium text-zinc-600">Próximos passos</div>
              <div className="mt-3 space-y-2 text-sm text-zinc-700">
                <div>1. Cadastre seu lead</div>
                <div>2. Registre as interações</div>
                <div>3. Atualize o status no Kanban</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
