"use client";

import { useEffect, useState } from "react";
import { Check, Cpu, Database, Loader2, ShieldCheck, Sparkles } from "lucide-react";

const STEPS = [
  { label: "Validando segurança BFF & Guardrail LGPD", icon: ShieldCheck },
  { label: "Decompondo consulta & buscando no Pinecone Serverless", icon: Database },
  { label: "Reordenando evidências com Cohere Rerank 3.5", icon: Cpu },
  { label: "Sintetizando resposta fundamentada (Amazon Nova Pro)", icon: Sparkles },
];

export function AgenticThinking() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 1450);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
        <Loader2 className="h-4 w-4 animate-spin text-sky-600 dark:text-sky-400" />
        Pipeline RAG Agêntico em execução...
      </div>
      <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const done = idx < activeStep;
          const current = idx === activeStep;
          return (
            <div
              key={step.label}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-all ${
                current
                  ? "bg-sky-50 font-semibold text-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
                  : done
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-slate-400 dark:text-slate-600"
              }`}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                {done ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : current ? (
                  <Icon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                ) : (
                  <Icon className="h-3.5 w-3.5 opacity-50" />
                )}
              </div>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
