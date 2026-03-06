"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Check,
  MessageCircle,
  Paperclip,
  Search,
  SendHorizonal,
  Settings,
  ShieldAlert,
  User,
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

type WhatsappSettingsRow = {
  api_base_url: string | null;
  instance_id: string | null;
  token: string | null;
  client_key: string | null;
  official_number: string | null;
  created_at?: string;
};

type SettingsFormState = {
  api_base_url: string;
  instance_id: string;
  token: string;
  client_key: string;
  official_number: string;
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
    return "ml-auto bg-[#DCF8C6] text-slate-900";
  }
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

  const [search, setSearch] = useState("");

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [supportsSettingsTable, setSupportsSettingsTable] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>({
    api_base_url: "https://api.z-api.io",
    instance_id: "",
    token: "",
    client_key: "",
    official_number: "",
  });

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const hay = `${t.contact_name ?? ""} ${t.contact_number ?? ""} ${t.external_id ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, threads]);

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

      if (res.error) {
        console.log("[WhatsApp] Erro ao carregar chat_threads:", res.error);
        throw res.error;
      }

      const rows = (res.data ?? []) as ThreadRow[];
      setThreads(rows);
      setSupportsTables(true);

      if (!selectedThreadId && rows.length > 0) {
        setSelectedThreadId(rows[0].id);
      }
    } catch {
      setSupportsTables(false);
      setThreads([]);
      setErrorMessage("Não foi possível carregar as conversas do WhatsApp agora.");
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

        if (res.error) {
          console.log("[WhatsApp] Erro ao carregar chat_messages:", res.error);
          throw res.error;
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

  async function toggleBossMode() {
    setBossMode((v) => !v);
  }

  const loadSettings = useCallback(async () => {
    if (!supabase) return;
    try {
      const res = await supabase
        .from("whatsapp_settings")
        .select("api_base_url, instance_id, token, client_key, official_number, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (res.error) {
        console.log("[WhatsApp] Erro ao carregar whatsapp_settings:", res.error);
        throw res.error;
      }

      const row = (res.data ?? null) as WhatsappSettingsRow | null;
      if (row) {
        setSettingsForm({
          api_base_url: row.api_base_url ?? "https://api.z-api.io",
          instance_id: row.instance_id ?? "",
          token: row.token ?? "",
          client_key: row.client_key ?? "",
          official_number: row.official_number ?? "",
        });
      }
      setSupportsSettingsTable(true);
    } catch {
      setSupportsSettingsTable(false);
    }
  }, [supabase]);

  const saveSettings = useCallback(async () => {
    setErrorMessage(null);
    if (!supabase) return;
    if (!supportsSettingsTable) {
      setErrorMessage("Tabela whatsapp_settings não encontrada no Supabase.");
      return;
    }

    setIsSavingSettings(true);
    try {
      const payload = {
        id: crypto.randomUUID(),
        api_base_url: settingsForm.api_base_url.trim() ? settingsForm.api_base_url.trim() : null,
        instance_id: settingsForm.instance_id.trim() ? settingsForm.instance_id.trim() : null,
        token: settingsForm.token.trim() ? settingsForm.token.trim() : null,
        client_key: settingsForm.client_key.trim() ? settingsForm.client_key.trim() : null,
        official_number: settingsForm.official_number.trim() ? settingsForm.official_number.trim() : null,
      };
      const res = await (supabase as any).from("whatsapp_settings").insert(payload);
      if (res.error) {
        console.log("[WhatsApp] Erro ao salvar whatsapp_settings:", res.error);
        setErrorMessage(res.error.message);
        setIsSavingSettings(false);
        return;
      }

      setIsSavingSettings(false);
      setIsConfigOpen(false);
      await loadSettings();
      await loadThreads();
    } catch {
      setIsSavingSettings(false);
      setErrorMessage("Não foi possível salvar a configuração agora.");
    }
  }, [loadSettings, loadThreads, settingsForm, supabase, supportsSettingsTable]);

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
      void loadSettings();
    }, 0);
    return () => clearTimeout(t);
  }, [loadBrokers, loadSettings, loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) return;
    void loadMessages(selectedThreadId);
  }, [loadMessages, selectedThreadId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const threadFromUrl = params.get("thread");
    if (!threadFromUrl) return;
    const exists = threads.some((t) => t.id === threadFromUrl);
    if (exists) setSelectedThreadId(threadFromUrl);
  }, [threads]);

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

      <section className="overflow-hidden rounded-3xl bg-white shadow-[0_20px_45px_-45px_rgba(0,0,0,0.55)] ring-1 ring-slate-200/70">
        <div className="grid h-[calc(100vh-260px)] grid-cols-1 lg:grid-cols-12">
          <aside className="flex h-full flex-col border-b border-slate-200/70 lg:col-span-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3 bg-[#001f3f] px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold">
                  B
                </div>
                <div>
                  <div className="text-sm font-semibold">Boss Central</div>
                  <div className="text-xs text-white/70">{supportsTables ? "Online" : "Verifique Supabase"}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsConfigOpen(true);
                  void loadSettings();
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition-all duration-300 hover:bg-white/15"
                aria-label="Configurar WhatsApp"
                title="Configurar"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar ou iniciar nova conversa"
                  className="h-11 w-full rounded-2xl bg-slate-50 pl-10 pr-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-[#001f3f]/10"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoadingThreads ? (
                <div className="px-4 py-6 text-sm text-slate-600">Carregando conversas...</div>
              ) : filteredThreads.length > 0 ? (
                filteredThreads.map((t) => {
                  const isActive = t.id === selectedThreadId;
                  const displayName = t.contact_name ?? t.contact_number ?? t.external_id ?? "Contato";
                  const brokerName = t.assigned_broker_profile_id
                    ? brokerById.get(t.assigned_broker_profile_id)?.full_name ?? "Corretor"
                    : "Boss";

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedThreadId(t.id)}
                      className={
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-200 " +
                        (isActive ? "bg-slate-100" : "hover:bg-slate-50")
                      }
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#001f3f] text-sm font-semibold text-white">
                        {initials(displayName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-semibold text-slate-900">{displayName}</div>
                          <div className="shrink-0 text-xs font-semibold text-slate-500">
                            {formatTime(t.last_message_at)}
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <div className="truncate text-xs text-slate-500">
                            {t.contact_number ?? ""}
                          </div>
                          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#001f3f] ring-1 ring-slate-200/70">
                            {brokerName}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-6 text-sm text-slate-600">Nenhuma conversa encontrada.</div>
              )}
            </div>
          </aside>

          <main className="flex h-full flex-col lg:col-span-8">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200/70 bg-white px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {initials(selectedThread?.contact_name ?? selectedThread?.contact_number ?? null)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {selectedThread
                      ? selectedThread.contact_name ?? selectedThread.contact_number ?? selectedThread.external_id ?? "-"
                      : "Selecione uma conversa"}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {selectedThread?.contact_number ?? ""}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedThread?.assigned_broker_profile_id ?? ""}
                  onChange={(e) =>
                    selectedThreadId ? void assignThreadToBroker(selectedThreadId, e.target.value) : null
                  }
                  disabled={!selectedThreadId}
                  className="hidden h-10 rounded-xl bg-white px-3 text-xs font-semibold text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-100 sm:block"
                >
                  <option value="">Boss</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name ?? b.id}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void toggleBossMode()}
                  className={
                    "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold ring-1 transition-all duration-300 hover:-translate-y-[1px] " +
                    (bossMode
                      ? "bg-[#ff0000] text-white ring-[#ff0000] hover:bg-[#e60000]"
                      : "bg-white text-slate-900 ring-slate-200/70 hover:bg-slate-50")
                  }
                  title="O Boss pode ler e enviar em qualquer conversa"
                >
                  <ShieldAlert className="h-4 w-4" />
                  {bossMode ? "Intervindo" : "Intervir"}
                </button>
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
              {!supportsTables ? (
                <div className="mb-4 rounded-2xl bg-amber-50 px-5 py-4 text-sm text-amber-900 ring-1 ring-amber-200/70">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4" />
                    <div>
                      <div className="font-semibold">Conexão com Supabase / tabelas</div>
                      <div className="mt-1 text-sm">
                        Não foi possível carregar <span className="font-semibold">chat_threads</span> e <span className="font-semibold">chat_messages</span>.
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {isLoadingMessages ? (
                <div className="text-sm text-slate-600">Carregando mensagens...</div>
              ) : messages.length === 0 ? (
                <div className="mx-auto mt-8 w-full max-w-md rounded-3xl bg-white/70 px-6 py-5 text-center text-sm text-slate-700 ring-1 ring-slate-200/70 backdrop-blur">
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
                      <div className="mt-1 flex items-center justify-end gap-2 text-[11px] font-medium text-slate-500">
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

            <div className="border-t border-slate-200/70 bg-white px-5 py-3">
              <div className="flex items-end gap-3">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                  title="Anexar (em breve)"
                >
                  <Paperclip className="h-5 w-5" />
                </button>

                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={selectedThreadId ? "Digite uma mensagem" : "Selecione uma conversa"}
                  disabled={!selectedThreadId || isSending}
                  className="min-h-11 flex-1 resize-none rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-[#001f3f]/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!selectedThreadId || isSending || !draft.trim()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#001f3f] px-5 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#001a33] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SendHorizonal className="h-4 w-4" />
                  Enviar
                </button>
              </div>
            </div>
          </main>
        </div>

        {isConfigOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 py-10">
            <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-[0_25px_60px_-45px_rgba(0,0,0,0.55)] ring-1 ring-slate-200/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Configuração WhatsApp (Z-API)</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Ajuste instância, token, clientKey e o número oficial.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-slate-200/70 transition-all duration-300 hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>

              {!supportsSettingsTable ? (
                <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200/70">
                  Tabela <span className="font-semibold">whatsapp_settings</span> não encontrada no Supabase.
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">API Base URL</span>
                  <input
                    value={settingsForm.api_base_url}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, api_base_url: e.target.value }))}
                    className="h-11 rounded-2xl bg-slate-50 px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    placeholder="https://api.z-api.io"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Instância</span>
                  <input
                    value={settingsForm.instance_id}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, instance_id: e.target.value }))}
                    className="h-11 rounded-2xl bg-slate-50 px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    placeholder="INSTANCE_ID"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Token</span>
                  <input
                    value={settingsForm.token}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, token: e.target.value }))}
                    className="h-11 rounded-2xl bg-slate-50 px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    placeholder="TOKEN"
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">ClientKey</span>
                  <input
                    value={settingsForm.client_key}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, client_key: e.target.value }))}
                    className="h-11 rounded-2xl bg-slate-50 px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    placeholder="CLIENT_KEY"
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className="text-xs font-semibold tracking-wide text-slate-600">Número Oficial</span>
                  <input
                    value={settingsForm.official_number}
                    onChange={(e) => setSettingsForm((s) => ({ ...s, official_number: e.target.value }))}
                    className="h-11 rounded-2xl bg-slate-50 px-4 text-sm text-slate-900 ring-1 ring-slate-200/70 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                    placeholder="Ex: 5591999999999"
                  />
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={isSavingSettings || !supportsSettingsTable}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#ff0000] px-6 text-sm font-semibold text-white shadow-[0_6px_14px_-10px_rgba(239,68,68,0.55)] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#e60000] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingSettings ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
