"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ArrowDown,
  BadgeCheck,
  MessageCircle,
  Send,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";

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

type BrokerProfile = {
  id: string;
  full_name: string | null;
  status: string | null;
  role?: string | null;
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
  if (direction === "out") {
    return "ml-auto bg-[#001f3f] text-white";
  }
  return "mr-auto bg-white text-slate-900 ring-1 ring-slate-200/70";
}

export default function WhatsAppPanelPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supportsTables, setSupportsTables] = useState(true);

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const brokerById = useMemo(() => {
    const map = new Map<string, BrokerProfile>();
    for (const b of brokers) map.set(b.id, b);
    return map;
  }, [brokers]);

  const [draft, setDraft] = useState<string>("");
  const [isSending, setIsSending] = useState(false);

  const [bossMode, setBossMode] = useState(false);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  const loadBrokers = useCallback(async () => {
    if (!supabase) return;
    try {
      const res = await supabase
        .from("profiles")
        .select("id, full_name, status, role")
        .eq("role", "broker")
        .order("full_name", { ascending: true });
      if (!res.error) setBrokers((res.data ?? []) as BrokerProfile[]);
    } catch {
      setBrokers([]);
    }
  }, [supabase]);

  const loadThreads = useCallback(async () => {
    setIsLoadingThreads(true);
    setErrorMessage(null);

    if (!supabase) {
      setErrorMessage(
        "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
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
        .order("last_message_at", { ascending: false });

      if (res.error) throw res.error;

      const rows = (res.data ?? []) as ThreadRow[];
      setThreads(rows);
      setSupportsTables(true);

      if (!selectedThreadId && rows.length > 0) {
        setSelectedThreadId(rows[0].id);
      }
    } catch {
      setSupportsTables(false);
      setThreads([]);
      setErrorMessage(
        "Tabelas chat_threads/chat_messages não encontradas. Crie o schema no Supabase para habilitar o painel.",
      );
    } finally {
      setIsLoadingThreads(false);
    }
  }, [selectedThreadId, supabase]);

  const loadMessages = useCallback(
    async (threadId: string) => {
      setIsLoadingMessages(true);
      setErrorMessage(null);

      if (!supabase) {
        setMessages([]);
        setIsLoadingMessages(false);
        return;
      }

      try {
        const res = await supabase
          .from("chat_messages")
          .select(
            "id, thread_id, broker_id, direction, from_number, to_number, message, sent_at",
          )
          .eq("thread_id", threadId)
          .order("sent_at", { ascending: true });

        if (res.error) throw res.error;

        setMessages((res.data ?? []) as MessageRow[]);
      } catch {
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [supabase],
  );

  async function toggleBossMode() {
    setBossMode((v) => !v);
  }

  async function assignThreadToBroker(threadId: string, brokerId: string) {
    if (!supabase) return;
    try {
      const res = await (supabase as any)
        .from("chat_threads")
        .update({ assigned_broker_profile_id: brokerId || null })
        .eq("id", threadId);
      if (!res.error) {
        setThreads((cur) =>
          cur.map((t) => (t.id === threadId ? { ...t, assigned_broker_profile_id: brokerId || null } : t)),
        );
      }
    } catch {
      // silent
    }
  }

  async function sendMessage() {
    setErrorMessage(null);

    if (!selectedThread || !selectedThreadId) {
      setErrorMessage("Selecione um chat.");
      return;
    }

    const phone = (selectedThread.contact_number ?? "").trim();
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone,
          message: msg,
          thread_id: selectedThreadId,
          broker_id: selectedThread.assigned_broker_profile_id,
          as_boss: bossMode,
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
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadBrokers();
      void loadThreads();
    }, 0);
    return () => clearTimeout(t);
  }, [loadBrokers, loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) return;
    void loadMessages(selectedThreadId);
  }, [loadMessages, selectedThreadId]);

  return (
    <div className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
          WHATSAPP BUSINESS CENTRAL
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Painel WhatsApp</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Custódia do Boss, distribuição para corretores e histórico auditável.
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200/70">
          {errorMessage}
        </div>
      ) : null}

      {!supportsTables ? (
        <div className="rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-800 ring-1 ring-amber-200/70">
          Modo degradado: schema do WhatsApp ainda não foi criado no Supabase.
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="rounded-2xl bg-white p-5 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Chats ativos</div>
                <div className="mt-1 text-xs text-slate-500">{threads.length} conversas</div>
              </div>
              <button
                type="button"
                onClick={() => void loadThreads()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:-translate-y-[1px] hover:bg-slate-50"
              >
                Atualizar
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {isLoadingThreads ? (
                <div className="rounded-xl bg-slate-50 px-4 py-8 text-sm text-slate-600 ring-1 ring-slate-200/70">
                  Carregando chats...
                </div>
              ) : threads.length > 0 ? (
                threads.map((t) => {
                  const isActive = t.id === selectedThreadId;
                  const brokerName = t.assigned_broker_profile_id
                    ? brokerById.get(t.assigned_broker_profile_id)?.full_name ?? "-"
                    : "Boss (não atribuído)";

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedThreadId(t.id)}
                      className={
                        "w-full rounded-2xl px-4 py-3 text-left ring-1 transition-all duration-300 hover:-translate-y-[1px] " +
                        (isActive
                          ? "bg-slate-900 text-white ring-slate-900"
                          : "bg-white text-slate-900 ring-slate-200/70 hover:bg-slate-50")
                      }
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <MessageCircle className={"h-4 w-4 " + (isActive ? "text-white" : "text-slate-500")} />
                            <div className="truncate text-sm font-semibold">
                              {t.contact_name ?? t.contact_number ?? t.external_id ?? "Chat"}
                            </div>
                          </div>
                          <div className={"mt-1 truncate text-xs " + (isActive ? "text-white/70" : "text-slate-500")}
                          >
                            Vinculado: {brokerName}
                          </div>
                        </div>
                        <div className={"text-xs font-semibold " + (isActive ? "text-white/80" : "text-slate-600")}
                        >
                          {formatTime(t.last_message_at)}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-xl bg-slate-50 px-4 py-8 text-sm text-slate-600 ring-1 ring-slate-200/70">
                  Nenhuma conversa ainda.
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="lg:col-span-8">
          <div className="rounded-2xl bg-white p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/70">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Conversa</div>
                <div className="mt-1 text-xs text-slate-500">
                  {selectedThread ? (
                    <>
                      {selectedThread.contact_name ?? selectedThread.contact_number ?? selectedThread.external_id ?? "-"}
                    </>
                  ) : (
                    "Selecione um chat"
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void toggleBossMode()}
                  className={
                    "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 transition-all duration-300 hover:-translate-y-[1px] " +
                    (bossMode
                      ? "bg-[#ff0000] text-white ring-[#ff0000] hover:bg-[#e60000]"
                      : "bg-white text-slate-900 ring-slate-200/70 hover:bg-slate-50")
                  }
                >
                  <ShieldAlert className="h-4 w-4" />
                  {bossMode ? "Boss intervindo" : "Intervir na Conversa"}
                </button>

                <button
                  type="button"
                  onClick={() => (selectedThreadId ? void loadMessages(selectedThreadId) : null)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#001f3f] px-4 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33]"
                >
                  <ArrowDown className="h-4 w-4" />
                  Atualizar mensagens
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-600">
                  <Users className="h-4 w-4" />
                  Custódia / Corretor
                </div>

                <div className="mt-3">
                  <select
                    value={selectedThread?.assigned_broker_profile_id ?? ""}
                    onChange={(e) =>
                      selectedThreadId
                        ? void assignThreadToBroker(selectedThreadId, e.target.value)
                        : null
                    }
                    disabled={!selectedThreadId}
                    className="h-11 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="">Boss (não atribuído)</option>
                    {brokers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.full_name ?? b.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  O Boss sempre pode ler/enviar. O corretor atua quando atribuído.
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-600">
                  <User className="h-4 w-4" />
                  Identificação do chat
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">
                  {selectedThread?.contact_number ?? "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  External ID: {selectedThread?.external_id ?? "-"}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-semibold text-slate-900">Mensagens</div>
                <div className="text-xs text-slate-500">
                  {isLoadingMessages ? "Carregando..." : `${messages.length} itens`}
                </div>
              </div>

              <div className="mt-4 flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
                {messages.length === 0 && !isLoadingMessages ? (
                  <div className="rounded-xl bg-white px-4 py-6 text-sm text-slate-600 ring-1 ring-slate-200/70">
                    Nenhuma mensagem ainda.
                  </div>
                ) : null}

                {messages.map((m) => (
                  <div key={m.id} className={"w-fit max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm " + bubbleCls(m.direction)}>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.message}</div>
                    <div className={"mt-2 text-[11px] font-medium " + (m.direction === "out" ? "text-white/70" : "text-slate-500")}>
                      {formatTime(m.sent_at)}
                      {m.broker_id ? (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {brokerById.get(m.broker_id)?.full_name ?? "Corretor"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <div className="text-xs font-semibold tracking-wide text-slate-600">Enviar mensagem</div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    selectedThreadId
                      ? bossMode
                        ? "Boss: escreva a intervenção..."
                        : "Escreva a mensagem do corretor..."
                      : "Selecione um chat"
                  }
                  disabled={!selectedThreadId || isSending}
                  className="mt-2 min-h-24 w-full rounded-2xl bg-white px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </div>

              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!selectedThreadId || isSending || !draft.trim()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#ff0000] px-6 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(239,68,68,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isSending ? "Enviando..." : "Enviar"}
              </button>
            </div>

            {!supportsTables ? (
              <div className="mt-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-800 ring-1 ring-amber-200/70">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4" />
                  <div>
                    <div className="font-semibold">Próximo passo obrigatório</div>
                    <div className="mt-1 text-sm">
                      Crie as tabelas <span className="font-semibold">chat_threads</span> e <span className="font-semibold">chat_messages</span> no Supabase.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </section>
    </div>
  );
}
