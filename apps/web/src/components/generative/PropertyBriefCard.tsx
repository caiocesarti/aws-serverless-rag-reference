"use client";

import Image from "next/image";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  KeyRound,
  MapPin,
} from "lucide-react";

import { formatBRL, type EmpreendimentoSpec, type TipologiaSpec } from "@/lib/portfolio";

interface PropertyBriefCardProps {
  spec: EmpreendimentoSpec;
  onSimulateTipologia: (tipologia: TipologiaSpec) => void;
  onAskAboutProperty: (prompt: string) => void;
}

export function PropertyBriefCard({
  spec,
  onSimulateTipologia,
  onAskAboutProperty,
}: PropertyBriefCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
      {/* Real Architectural Hero Photo */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-900 sm:h-52">
        <Image
          src={spec.image}
          alt={spec.imageAlt}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 860px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-slate-900 shadow-xs">
            {spec.statusCurto}
          </span>
          <span className="rounded-full bg-slate-950/75 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-sky-200 backdrop-blur-xs">
            {spec.codigo}
          </span>
        </div>

        <div className="absolute right-4 bottom-3.5 left-4 flex flex-wrap items-end justify-between gap-2 text-white">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">
              {spec.nome}
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-200">
              <MapPin className="h-3.5 w-3.5 text-sky-300" />
              {spec.endereco} · Entrega {spec.entrega}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-base font-bold text-white">{spec.precoM2}</p>
            <p className="text-[11px] text-slate-300">Cond. {spec.condominioEstimado}</p>
          </div>
        </div>
      </div>

      {/* Concise 3-pill key rules bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] dark:border-slate-800 dark:bg-slate-950/40">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
            spec.permiteRemoverParede === "proibido"
              ? "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300"
              : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {spec.permiteRemoverParede === "proibido" ? (
            <AlertTriangle className="h-3 w-3" />
          ) : null}
          {spec.permiteRemoverParede === "proibido"
            ? "Alvenaria estrutural (não remover paredes)"
            : spec.permiteRemoverParede === "drywall"
              ? "Drywall remanejável"
              : "Permite reforma c/ ART/RRT"}
        </span>

        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <KeyRound className="h-3 w-3" />
          {spec.aceitaAirbnb ? "Airbnb permitido" : `Airbnb proibido (${spec.prazoMinLocacao})`}
        </span>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
            spec.aceitaFgts
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
              : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <CheckCircle2 className="h-3 w-3" />
          {spec.enquadramentoCredito}
        </span>
      </div>

      {/* Clean Tipologias Row */}
      <div className="grid gap-2.5 p-4 md:grid-cols-3">
        {spec.tipologias.map((t) => (
          <div
            key={t.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200/80 p-3 dark:border-slate-800"
          >
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {t.privativaTotalM2.toFixed(2).replace(".", ",")} m²
                </span>
                <span className="font-mono text-xs font-bold text-sky-700 dark:text-sky-400">
                  {formatBRL(t.precoBase)}
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.dormitorios}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t.vagas}</p>
            </div>

            <div className="mt-3 flex gap-1.5">
              <button
                type="button"
                onClick={() => onSimulateTipologia(t)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:border-sky-500 hover:text-sky-700 dark:border-slate-700 dark:text-slate-200"
              >
                <Calculator className="h-3 w-3" />
                Simular
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskAboutProperty(
                    `Quais são as especificações, acabamentos e condições de financiamento para o ${spec.nome} — ${t.nome} (${t.privativaTotalM2} m²)?`
                  )
                }
                className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                Consultar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
