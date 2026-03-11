"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  status: string | null;
};

function isAllowedBroker(profile: ProfileRow | null) {
  if (!profile) return false;
  const role = (profile.role ?? "").toLowerCase().trim();
  const status = (profile.status ?? "").toLowerCase().trim();
  return role === "broker" && status === "ativo";
}

export default function CorretorLayout({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const router = useRouter();
  const pathname = usePathname();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    let canceled = false;

    async function loadOnce() {
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

      if (canceled) return;

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const userId = authData.user.id;

      const profRes = await supabase
        .from("profiles")
        .select("id, full_name, role, status")
        .eq("id", userId)
        .maybeSingle();

      if (canceled) return;

      if (profRes.error) {
        console.error("[Corretor Guard] Falha ao carregar profile", { userId, error: profRes.error });
        setErrorMessage(profRes.error.message);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      const row = (profRes.data ?? null) as ProfileRow | null;
      setProfile(row);

      if (!isAllowedBroker(row)) {
        router.replace("/login");
        return;
      }

      setIsLoading(false);
    }

    void loadOnce();

    const intervalId = window.setInterval(() => {
      void loadOnce();
    }, 15000);

    function onFocus() {
      void loadOnce();
    }

    window.addEventListener("focus", onFocus);

    return () => {
      canceled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">Carregando...</div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{errorMessage}</div>
        </div>
      </div>
    );
  }

  const nav = [
    { href: "/corretor/leads", label: "Leads p/ Qualificar" },
    { href: "/corretor/inventario", label: "Meus Imóveis" },
    { href: "/corretor/enviados", label: "Imóveis Enviados" },
    { href: "/corretor/whatsapp", label: "Central WhatsApp" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <div className="text-sm font-semibold text-[#1e3a8a]">Portal do Corretor</div>
            <div className="text-xs text-zinc-500">{profile?.full_name ?? "Corretor"}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors " +
                    (active
                      ? "bg-[#1e3a8a] text-white"
                      : "border border-zinc-200 bg-white text-[#1e3a8a] hover:bg-zinc-50")
                  }
                >
                  {item.label}
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => {
                if (!supabase) return;
                try {
                  document.cookie = "crm_user_id=; Path=/; Max-Age=0; SameSite=Lax";
                } catch {
                  // ignore
                }
                void supabase.auth.signOut().finally(() => router.replace("/login"));
              }}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Sair
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 py-8">{children}</div>
    </div>
  );
}
