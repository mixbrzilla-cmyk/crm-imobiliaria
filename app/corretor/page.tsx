"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  status: string | null;
  role: string | null;
};

export default function CorretorHomePage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
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

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          setErrorMessage("Sessão expirada. Faça login novamente.");
          setProfile(null);
          setIsLoading(false);
          return;
        }

        const userId = authData.user.id;
        const profRes = await supabase
          .from("profiles")
          .select("id, full_name, status, role")
          .eq("id", userId)
          .maybeSingle();

        if (profRes.error) {
          setErrorMessage(profRes.error.message);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        setProfile((profRes.data ?? null) as Profile | null);
        setIsLoading(false);
      })();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-[#1e3a8a]">Portal do Corretor</div>
        <div className="text-xs text-zinc-500">{profile?.full_name ?? ""}</div>
      </header>

      <div>
        {isLoading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
            Carregando...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Link
              href="/corretor/leads"
              className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:bg-zinc-50"
            >
              <div className="text-sm font-semibold text-[#1e3a8a]">Leads para Qualificar</div>
              <div className="mt-1 text-xs text-zinc-600">Fila enviada pela Imobiliária Moderna + acesso rápido ao WhatsApp.</div>
            </Link>
            <Link
              href="/corretor/inventario"
              className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:bg-zinc-50"
            >
              <div className="text-sm font-semibold text-[#1e3a8a]">Meus Imóveis</div>
              <div className="mt-1 text-xs text-zinc-600">Cadastre captações e mande para aprovação.</div>
            </Link>
            <Link
              href="/corretor/enviados"
              className="rounded-xl border border-[#dc2626]/30 bg-[#dc2626]/5 p-6 transition-colors hover:bg-[#dc2626]/10"
            >
              <div className="text-sm font-semibold text-[#dc2626]">Imóveis Enviados pela Imobiliária Moderna</div>
              <div className="mt-1 text-xs text-zinc-700">Atribuídos a você para atendimento (com WhatsApp do proprietário).</div>
            </Link>
            <Link
              href="/corretor/whatsapp"
              className="rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:bg-zinc-50"
            >
              <div className="text-sm font-semibold text-[#1e3a8a]">Central WhatsApp</div>
              <div className="mt-1 text-xs text-zinc-600">Conversas auditáveis no painel da Imobiliária Moderna.</div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
