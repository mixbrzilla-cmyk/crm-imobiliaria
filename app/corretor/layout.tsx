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
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    let canceled = false;

    async function loadOnce(options?: { silent?: boolean }) {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setIsLoading(true);
        setErrorMessage(null);
      }

      if (!supabase) {
        if (!silent) {
          setErrorMessage(
            "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
          );
          setProfile(null);
          setIsLoading(false);
        }
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
        if (!silent) {
          setErrorMessage(profRes.error.message);
          setProfile(null);
          setIsLoading(false);
        }
        return;
      }

      const row = (profRes.data ?? null) as ProfileRow | null;
      setProfile(row);

      if (!isAllowedBroker(row)) {
        router.replace("/login");
        return;
      }

      if (!silent) {
        setIsLoading(false);
        setHasLoadedOnce(true);
      } else if (!hasLoadedOnce) {
        setHasLoadedOnce(true);
        setIsLoading(false);
      }
    }

    void loadOnce();

    const intervalId = window.setInterval(() => {
      void loadOnce({ silent: true });
    }, 15000);

    function onFocus() {
      void loadOnce({ silent: true });
    }

    window.addEventListener("focus", onFocus);

    return () => {
      canceled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, supabase, hasLoadedOnce]);

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
      <div className="border-b border-zinc-200 bg-gradient-to-b from-white to-zinc-50/40">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#001f3f] text-sm font-extrabold tracking-tight text-white shadow-sm ring-1 ring-[#001f3f]/20">
              IM
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-extrabold tracking-tight text-[#001f3f]">Imobiliária Moderna</div>
              <div className="text-xs font-medium text-zinc-500">{profile?.full_name ?? "Corretor"}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-all duration-300 " +
                    (active
                      ? "bg-[#001f3f] text-white shadow-sm"
                      : "border border-zinc-200 bg-white/70 text-[#001f3f] hover:bg-white")
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
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white/70 px-4 text-sm font-semibold text-zinc-700 transition-all duration-300 hover:bg-white"
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
