"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  Calculator,
  Menu,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";

import { AgenticThinking } from "@/components/chat/AgenticThinking";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { CitationDrawer } from "@/components/citations/CitationDrawer";
import { PropertyBriefCard } from "@/components/generative/PropertyBriefCard";
import { PortfolioSidebar } from "@/components/sidebar/PortfolioSidebar";
import {
  formatBRL,
  PORTFOLIO,
  QUICK_PROMPTS,
  type TipologiaSpec,
} from "@/lib/portfolio";
import type {
  ChatMessage,
  Citation,
  DominioKb,
  EmpreendimentoId,
  HealthResponse,
  Persona,
} from "@/lib/types";

const SacPriceSimulatorModal = dynamic(
  () =>
    import("@/components/generative/SacPriceSimulatorModal").then(
      (mod) => mod.SacPriceSimulatorModal
    ),
  { ssr: false }
);

const MAX_PROMPT_LENGTH = 1000;

function formatNow(): string {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImobiSmartWorkspace() {
  const [persona, setPersona] = useState<Persona>("corretor");
  const [empreendimento, setEmpreendimento] = useState<EmpreendimentoId>("todos");
  const [dominios, setDominios] = useState<DominioKb[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorTipologia, setSimulatorTipologia] = useState<TipologiaSpec | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [health, setHealth] = useState<HealthResponse>({ status: "offline" });

  const mainRef = useRef<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("imobismart-theme");
    const prefersDark =
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDarkMode(prefersDark);
    document.documentElement.classList.toggle("dark", prefersDark);
  }, []);

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      window.localStorage.setItem("imobismart-theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/health", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: HealthResponse) => {
        if (active) setHealth(data);
      })
      .catch(() => {
        if (active) setHealth({ status: "offline" });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0 || loading) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, loading]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [empreendimento]);

  const selectedProperty = useMemo(
    () => PORTFOLIO.find((p) => p.id === empreendimento) ?? null,
    [empreendimento]
  );

  const handleToggleDominio = useCallback((dom: DominioKb) => {
    setDominios((prev) =>
      prev.includes(dom) ? prev.filter((item) => item !== dom) : [...prev, dom]
    );
  }, []);

  const sendPrompt = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || loading) return;

      setErrorBanner(null);
      setInput("");

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: formatNow(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            persona,
            ...(sessionId ? { session_id: sessionId } : {}),
            ...(empreendimento !== "todos" ? { empreendimento } : {}),
            ...(dominios.length > 0 ? { dominios } : {}),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string"
              ? data.error
              : `Erro HTTP ${res.status} ao consultar o backend.`
          );
        }

        if (typeof data.session_id === "string" && data.session_id) {
          setSessionId(data.session_id);
        }

        const aiMsg: ChatMessage = {
          id: data.message_id || `ai-${Date.now()}`,
          role: "assistant",
          content: data.answer || "Não foi possível gerar uma resposta.",
          timestamp: formatNow(),
          citations: Array.isArray(data.citations) ? data.citations : [],
          guardrailAction: data.guardrail_action,
          latencyMs: typeof data.latency_ms === "number" ? data.latency_ms : undefined,
          feedback: null,
          filtersApplied: data.filters_applied,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Erro inesperado ao consultar a IA.";
        setErrorBanner(msg);
      } finally {
        setLoading(false);
        textareaRef.current?.focus();
      }
    },
    [dominios, empreendimento, loading, persona, sessionId]
  );

  const handleFeedback = useCallback(
    async (messageId: string, rating: "up" | "down") => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: rating } : m))
      );
      if (!sessionId) return;
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            message_id: messageId,
            rating,
          }),
        });
      } catch {
        // Non-blocking telemetry
      }
    },
    [sessionId]
  );

  const handleNewSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setErrorBanner(null);
    setActiveCitation(null);
  }, []);

  const handleOpenSimulatorWithTipologia = useCallback((tip: TipologiaSpec) => {
    setSimulatorTipologia(tip);
    setSimulatorOpen(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendPrompt(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendPrompt(input);
    }
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Zone 1: Clean Photographic Sidebar */}
      <PortfolioSidebar
        persona={persona}
        onPersonaChange={setPersona}
        empreendimento={empreendimento}
        onEmpreendimentoChange={setEmpreendimento}
        dominios={dominios}
        onToggleDominio={handleToggleDominio}
        health={health}
        onOpenSimulator={() => {
          setSimulatorTipologia(null);
          setSimulatorOpen(true);
        }}
        onNewChat={handleNewSession}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Zone 2: Breathable Conversational Canvas */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#F8F9FB] dark:bg-[#090D16]">
        {/* Minimal Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur-md sm:px-6 dark:border-slate-800/80 dark:bg-[#0D1320]/90">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir portfólio"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>

            <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {selectedProperty ? selectedProperty.nome : "ImobiSmart AI"}
            </span>
            {dominios.length > 0 ? (
              <span className="hidden rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 sm:inline-flex dark:bg-sky-950 dark:text-sky-300">
                {dominios.length} filtro{dominios.length > 1 ? "s" : ""} ativo
                {dominios.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSimulatorTipologia(null);
                setSimulatorOpen(true);
              }}
              className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-sky-500 hover:text-sky-700 sm:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Calculator className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              Simulador SAC/Price
            </button>

            {messages.length > 0 ? (
              <button
                type="button"
                onClick={handleNewSession}
                title="Nova consulta"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Nova</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Alternar tema"
              className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            {/* Property Hero when a specific building is selected */}
            {selectedProperty ? (
              <PropertyBriefCard
                spec={selectedProperty}
                onSimulateTipologia={handleOpenSimulatorWithTipologia}
                onAskAboutProperty={(q) => void sendPrompt(q)}
              />
            ) : null}

            {/* Clean Visual Empty State */}
            {messages.length === 0 ? (
              <div className="space-y-6">
                {!selectedProperty ? (
                  <>
                    <div className="pt-2 text-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        Base Técnica Oficial · Citações em PDF Verificáveis
                      </span>
                      <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                        Consulte nosso portfólio e regras de crédito
                      </h1>
                      <p className="mx-auto mt-1.5 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                        Selecione um empreendimento para ver as plantas e preços, ou faça qualquer
                        pergunta técnica abaixo.
                      </p>
                    </div>

                    {/* Visual 3-Property Gallery */}
                    <div className="grid gap-4 md:grid-cols-3">
                      {PORTFOLIO.map((emp) => {
                        const minPrice = emp.tipologias[0]?.precoBase ?? 0;
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => setEmpreendimento(emp.id)}
                            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-left shadow-2xs transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-sky-500/60"
                          >
                            <div className="relative h-36 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                              <Image
                                src={emp.image}
                                alt={emp.imageAlt}
                                fill
                                priority
                                sizes="(max-width: 768px) 100vw, 280px"
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                              <span className="absolute top-2.5 left-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-slate-900 shadow-xs">
                                {emp.statusCurto}
                              </span>
                            </div>
                            <div className="flex flex-1 flex-col justify-between p-4">
                              <div>
                                <p className="text-sm font-bold text-slate-900 group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-400">
                                  {emp.nomeCurto}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                  {emp.bairro.split(" · ")[0]} · {emp.segmento.split(" (")[0]}
                                </p>
                              </div>
                              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                                <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                                  A partir de {formatBRL(minPrice)}
                                </span>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {/* Lightweight Suggested Prompt Chips */}
                <div>
                  <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <Sparkles className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    Sugestões rápidas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => void sendPrompt(item.prompt)}
                        className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:border-sky-500 hover:bg-sky-50/70 hover:text-sky-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-200"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Messages Thread */}
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onOpenCitation={setActiveCitation}
                onFeedback={handleFeedback}
              />
            ))}

            {loading ? <AgenticThinking /> : null}

            {errorBanner ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                ⚠️ {errorBanner}
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>
        </main>

        {/* Minimal Composer */}
        <footer className="shrink-0 border-t border-slate-200/70 bg-white/95 px-4 py-3 sm:px-8 dark:border-slate-800/80 dark:bg-[#0D1320]/95">
          <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-1.5 shadow-xs transition-all focus-within:border-sky-600 focus-within:ring-2 focus-within:ring-sky-500/15 dark:border-slate-700 dark:bg-slate-900">
              <textarea
                id="chat-prompt-input"
                name="prompt"
                ref={textareaRef}
                rows={1}
                value={input}
                maxLength={MAX_PROMPT_LENGTH}
                disabled={loading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre plantas, remoção de paredes, Airbnb, regras do condomínio ou financiamento..."
                className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60 dark:text-white dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={loading || input.trim().length < 2}
                aria-label="Enviar consulta"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-all hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-slate-400">
              <span>Protegido por Guardrail LGPD · Evite informar CPF, e-mail ou telefone</span>
              <span className="font-mono">
                {input.length}/{MAX_PROMPT_LENGTH}
              </span>
            </div>
          </form>
        </footer>
      </div>

      {/* Zone 3: Citation & Official PDF Inspector Drawer */}
      <CitationDrawer
        citation={activeCitation}
        onClose={() => setActiveCitation(null)}
      />

      {/* Interactive SAC vs Price Simulator Modal */}
      {simulatorOpen ? (
        <SacPriceSimulatorModal
          open={simulatorOpen}
          initialTipologia={simulatorTipologia}
          onClose={() => setSimulatorOpen(false)}
          onAskAi={(q) => void sendPrompt(q)}
        />
      ) : null}
    </div>
  );
}
