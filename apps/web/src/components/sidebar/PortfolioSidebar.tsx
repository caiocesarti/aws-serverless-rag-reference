"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  Building2,
  Calculator,
  Check,
  ChevronDown,
  LayoutGrid,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { DOMINIOS_KB, PORTFOLIO } from "@/lib/portfolio";
import type {
  DominioKb,
  EmpreendimentoId,
  HealthResponse,
  Persona,
} from "@/lib/types";

interface PortfolioSidebarProps {
  persona: Persona;
  onPersonaChange: (p: Persona) => void;
  empreendimento: EmpreendimentoId;
  onEmpreendimentoChange: (id: EmpreendimentoId) => void;
  dominios: DominioKb[];
  onToggleDominio: (d: DominioKb) => void;
  health: HealthResponse;
  onOpenSimulator: () => void;
  onNewChat: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function PortfolioSidebar({
  persona,
  onPersonaChange,
  empreendimento,
  onEmpreendimentoChange,
  dominios,
  onToggleDominio,
  health,
  onOpenSimulator,
  onNewChat,
  mobileOpen,
  onCloseMobile,
}: PortfolioSidebarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement | null>(null);

  const handleToggleFilters = () => {
    setFiltersOpen((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => {
          filtersRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
      }
      return next;
    });
  };

  const healthDot =
    health.status === "ok"
      ? "bg-emerald-500"
      : health.status === "degraded"
        ? "bg-amber-500"
        : "bg-slate-400";

  const content = (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-[#0D1320]">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-sky-600">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              ImobiSmart AI
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Consultor Imobiliário
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            title="Nova consulta"
            aria-label="Nova consulta"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Portfolio */}
      <div className="flex-1 space-y-4 overflow-y-auto px-3.5 py-2">
        <button
          type="button"
          onClick={() => {
            onEmpreendimentoChange("todos");
            onCloseMobile();
          }}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all ${
            empreendimento === "todos"
              ? "bg-slate-900 text-white shadow-xs dark:bg-sky-600"
              : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
          <span>Todos os Empreendimentos</span>
        </button>

        {/* Photographic Property Cards */}
        <div className="space-y-2.5">
          <p className="px-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Empreendimentos
          </p>
          {PORTFOLIO.map((emp) => {
            const active = empreendimento === emp.id;
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => {
                  onEmpreendimentoChange(emp.id);
                  onCloseMobile();
                }}
                className={`group w-full overflow-hidden rounded-2xl border text-left transition-all ${
                  active
                    ? "border-sky-500 ring-2 ring-sky-500/20 dark:border-sky-400"
                    : "border-slate-200/90 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                }`}
              >
                <div className="relative h-24 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                  <Image
                    src={emp.image}
                    alt={emp.imageAlt}
                    fill
                    sizes="260px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />
                  <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-900 backdrop-blur-xs">
                    {emp.statusCurto}
                  </span>
                  <div className="absolute right-2.5 bottom-2 left-2.5 flex items-end justify-between gap-2 text-white">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold leading-tight">
                        {emp.nomeCurto}
                      </p>
                      <p className="truncate text-[10px] text-slate-200">
                        {emp.bairro.split(" · ")[0]}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-mono text-[10px] font-semibold text-sky-200">
                      {emp.precoM2}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Collapsible Progressive Disclosure: Filters & Persona */}
        <div
          ref={filtersRef}
          className="rounded-xl border border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40"
        >
          <button
            type="button"
            onClick={handleToggleFilters}
            className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              Filtros & Perfil
            </span>
            <div className="flex items-center gap-1.5">
              {dominios.length > 0 || persona === "comprador" ? (
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              ) : null}
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                  filtersOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>

          {filtersOpen ? (
            <div className="space-y-3 border-t border-slate-200/80 px-3 py-3 dark:border-slate-800">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold text-slate-500 uppercase">
                  Tom da Resposta
                </p>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200/70 p-0.5 dark:bg-slate-800">
                  {(["corretor", "comprador"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onPersonaChange(p)}
                      className={`rounded-md py-1.5 text-[11px] font-semibold capitalize transition-all ${
                        persona === p
                          ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-950 dark:text-white"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold text-slate-500 uppercase">
                  Escopo na Base (Pinecone)
                </p>
                <div className="space-y-1">
                  {DOMINIOS_KB.map((dom) => {
                    const selected = dominios.includes(dom.id);
                    return (
                      <button
                        key={dom.id}
                        type="button"
                        onClick={() => onToggleDominio(dom.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium transition-colors ${
                          selected
                            ? "bg-sky-100/80 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200"
                            : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span>{dom.label}</span>
                        {selected ? <Check className="h-3 w-3 text-sky-600" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Minimal Footer */}
      <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 dark:border-slate-800/80">
        <span className="flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
          <span className={`h-2 w-2 rounded-full ${healthDot}`} />
          {health.status === "ok" ? "Bedrock Online" : "Conectando..."}
        </span>
        <button
          type="button"
          onClick={() => {
            onOpenSimulator();
            onCloseMobile();
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-800 transition-colors hover:bg-sky-600 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-sky-600"
        >
          <Calculator className="h-3 w-3" />
          Simulador
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden h-full shrink-0 lg:block">{content}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      ) : null}
    </>
  );
}
