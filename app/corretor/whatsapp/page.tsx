"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Check, Search, SendHorizonal } from "lucide-react";

import { getSupabaseClient } from "@/lib/supabaseClient";

type ThreadRow = {
  id: string;
  external_id: string | null;
  contact_number: string | null;
  contact_name: string | null;
  assigned_broker_profile_id: string | null;
  status: string | null;
  last_message_at: string | null;
  created_at?: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  broker_id: string | null;
  direction: "in" | "out" | string;
  from_number: string | null;
  to_number: string | null;
  message: string;
  sent_at: string | null;
};

function formatTime(value: string | null) {
  if (!value) return "-";
  try {
    const d = new Date(value);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function bubbleCls(direction: string) {
  if (direction === "out") return "ml-auto bg-[#DCF8C6] text-slate-900";
  return "mr-auto bg-white text-slate-900";
}

function initials(name: string | null) {
  const raw = (name ?? "").trim();
  if (!raw) return "?";
  const parts = raw.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase();
}

function normalizePhone(phone: string) {
  return String(phone ?? "").replace(/\D+/g, "").trim();
}

export default function CorretorWhatsAppPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [brokerId, setBrokerId] = useState<string>("");

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [search, setSearch] = useState("");

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const hay = `${t.contact_name ?? ""} ${t.contact_number ?? ""} ${t.external_id ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, threads]);

  const ensureThreadByPhone = useCallback(
    async (phone: string) => {
      if (!supabase) return null;
      if (!brokerId) return null;
      const normalized = normalizePhone(phone);
      if (!normalized) return null;

      try {
        const existing = await supabase
          .from("chat_threads")
          .select("id, assigned_broker_profile_id")
          .eq("external_id", normalized)
          .maybeSingle();

        if (!existing.error && existing.data?.id) {
          const threadId = String(existing.data.id);
          const assigned = String(existing.data.assigned_broker_profile_id ?? "");
          if (!assigned || assigned !== brokerId) {
            await (supabase as any)
              .from("chat_threads")
              .update({ assigned_broker_profile_id: brokerId })
              .eq("id", threadId);
          }
          return threadId;
        }

        const id = crypto.randomUUID();
        const insert = await (supabase as any).from("chat_threads").insert({
          id,
          external_id: normalized,
          contact_number: normalized,
          contact_name: null,
          status: "active",
          last_message_at: new Date().toISOString(),
          assigned_broker_profile_id: brokerId,
        });
        if (insert.error) return null;
        return id;
      } catch {
        return null;
      }
    },
    [brokerId, supabase],
  );

  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true);
    setErrorMessage(null);
    setInfoMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      setThreads([]);
      setIsLoadingThreads(false);
      return;
    }

    if (!brokerId) {
      setThreads([]);
      setIsLoadingThreads(false);
      return;
    }

    try {
      const res = await supabase
        .from("chat_threads")
        .select(
          "id, external_id, contact_number, contact_name, assigned_broker_profile_id, status, last_message_at, created_at",
        )
        .eq("assigned_broker_profile_id", brokerId)
        .order("last_message_at", { ascending: false });

      if (res.error) {
        console.log("DEBUG SUPABASE:", res.error);
        setThreads([]);
        setInfoMessage(
          "Infra do WhatsApp pendente no Supabase (chat_threads/chat_messages). Execute o SQL para criar as tabelas.",
        );
        setIsLoadingThreads(false);
        return;
      }

      const rows = (res.data ?? []) as ThreadRow[];
      setThreads(rows);
      if (!selectedThreadId && rows.length > 0) setSelectedThreadId(rows[0].id);
    } catch {
      setThreads([]);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [brokerId, selectedThreadId, supabase]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      if (!supabase) return;
      setIsLoadingMessages(true);
      setErrorMessage(null);
      setInfoMessage(null);

      try {
        const res = await supabase
          .from("chat_messages")
          .select("id, thread_id, broker_id, direction, from_number, to_number, message, sent_at")
          .eq("thread_id", threadId)
          .order("sent_at", { ascending: true });

        if (res.error) {
          console.log("DEBUG SUPABASE:", res.error);
          setMessages([]);
          setIsLoadingMessages(false);
          return;
        }

        setMessages((res.data ?? []) as MessageRow[]);
      } catch {
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [supabase],
  );

  const sendMessage = useCallback(async () => {
    setErrorMessage(null);

    if (!selectedThreadId || !selectedThread) {
      setErrorMessage("Selecione um chat.");
      return;
    }

    const phone = String(selectedThread.contact_number ?? "").trim();
    if (!phone) {
      setErrorMessage("Número do contato não disponível.");
      return;
    }

    const msg = draft.trim();
    if (!msg) return;

    setIsSending(true);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          message: msg,
          thread_id: selectedThreadId,
          broker_id: brokerId,
          as_boss: false,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setErrorMessage(json?.error ?? "Falha ao enviar mensagem.");
        setIsSending(false);
        return;
      }

      setDraft("");
      await loadMessages(selectedThreadId);
      await loadThreads();
    } catch {
      setErrorMessage("Não foi possível enviar a mensagem agora.");
    } finally {
      setIsSending(false);
    }
  }, [brokerId, draft, loadMessages, loadThreads, selectedThread, selectedThreadId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        if (!supabase) {
          setBrokerId("");
          return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          setBrokerId("");
          setErrorMessage("Sessão expirada. Faça login novamente.");
          return;
        }

        setBrokerId(data.user.id);
      })();
    }, 0);

    return () => window.clearTimeout(t);
  }, [supabase]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadThreads();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) return;
    void loadMessages(selectedThreadId);
  }, [loadMessages, selectedThreadId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const phone = params.get("phone");
    if (!phone) return;

    void (async () => {
      const id = await ensureThreadByPhone(phone);
      if (id) {
        await loadThreads();
        setSelectedThreadId(id);
      }
    })();
  }, [ensureThreadByPhone, loadThreads]);

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-[color:var(--imob-navy)]">Central WhatsApp</div>
        <div className="text-xs text-zinc-500">Converse com proprietários com auditoria da Imobiliária Moderna no Admin.</div>
      </header>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      {infoMessage ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{infoMessage}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
        <div className="grid h-[calc(100vh-240px)] grid-cols-1 lg:grid-cols-12">
          <aside className="flex h-full flex-col border-b border-zinc-200 lg:col-span-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3 bg-[color:var(--imob-navy)] px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold">C</div>
                <div>
                  <div className="text-sm font-semibold">Corretor</div>
                  <div className="text-xs text-white/70">Online</div>
                </div>
              </div>
              <Link
                href="/corretor/leads"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white/10 px-3 text-xs font-semibold text-white transition-all duration-200 hover:bg-white/15"
              >
                Voltar
              </Link>
            </div>

            <div className="px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar"
                  className="h-11 w-full rounded-2xl bg-zinc-50 pl-10 pr-4 text-sm text-zinc-900 ring-1 ring-zinc-200 outline-none focus:bg-white focus:ring-2 focus:ring-[color:var(--imob-navy)]/20"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingThreads ? (
                <div className="px-4 py-6 text-sm text-zinc-600">Carregando conversas...</div>
              ) : filteredThreads.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-600">Nenhuma conversa atribuída a você.</div>
              ) : (
                filteredThreads.map((t) => {
                  const isActive = t.id === selectedThreadId;
                  const displayName = t.contact_name ?? t.contact_number ?? t.external_id ?? "Contato";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedThreadId(t.id)}
                      className={
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors " +
                        (isActive ? "bg-zinc-100" : "hover:bg-zinc-50")
                      }
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--imob-navy)] text-sm font-semibold text-white">
                        {initials(displayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-semibold text-zinc-900">{displayName}</div>
                          <div className="shrink-0 text-xs font-semibold text-zinc-500">{formatTime(t.last_message_at)}</div>
                        </div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{t.contact_number ?? ""}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <main className="flex h-full flex-col lg:col-span-8">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                  {initials(selectedThread?.contact_name ?? selectedThread?.contact_number ?? null)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">
                    {selectedThread
                      ? selectedThread.contact_name ??
                        selectedThread.contact_number ??
                        selectedThread.external_id ??
                        "-"
                      : "Selecione uma conversa"}
                  </div>
                  <div className="truncate text-xs text-zinc-500">{selectedThread?.contact_number ?? ""}</div>
                </div>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto px-5 py-5"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 10px 10px, rgba(15, 23, 42, 0.04) 0, rgba(15, 23, 42, 0.04) 2px, transparent 2px), radial-gradient(circle at 30px 30px, rgba(15, 23, 42, 0.035) 0, rgba(15, 23, 42, 0.035) 2px, transparent 2px)",
                backgroundSize: "48px 48px",
              }}
            >
              {isLoadingMessages ? (
                <div className="text-sm text-zinc-600">Carregando mensagens...</div>
              ) : messages.length === 0 ? (
                <div className="mx-auto mt-8 w-full max-w-md rounded-3xl bg-white/70 px-6 py-5 text-center text-sm text-zinc-700 ring-1 ring-zinc-200 backdrop-blur">
                  Selecione uma conversa à esquerda para visualizar.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        "w-fit max-w-[86%] rounded-2xl px-4 py-2.5 text-sm shadow-[0_2px_6px_-4px_rgba(0,0,0,0.25)] " +
                        bubbleCls(m.direction)
                      }
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">{m.message}</div>
                      <div className="mt-1 flex items-center justify-end gap-2 text-[11px] font-medium text-zinc-500">
                        <span>{formatTime(m.sent_at)}</span>
                        {m.direction === "out" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                            <Check className="h-3.5 w-3.5 -ml-2" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-zinc-200 bg-white px-5 py-3">
              <div className="flex items-end gap-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={selectedThreadId ? "Digite uma mensagem" : "Selecione uma conversa"}
                  disabled={!selectedThreadId || isSending}
                  className="min-h-11 flex-1 resize-none rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-900 ring-1 ring-zinc-200 outline-none focus:bg-white focus:ring-2 focus:ring-[color:var(--imob-navy)]/20 disabled:cursor-not-allowed disabled:bg-zinc-100"
                />

                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!selectedThreadId || isSending || !draft.trim()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[color:var(--imob-navy)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SendHorizonal className="h-4 w-4" />
                  Enviar
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
