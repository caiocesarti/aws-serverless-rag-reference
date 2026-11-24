"use client";

import { memo, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquareShare,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { formatBRL } from "@/lib/portfolio";
import { formatForWhatsApp } from "@/lib/whatsapp-formatter";
import type { ChatMessage, Citation } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
  onOpenCitation: (citation: Citation) => void;
  onFeedback: (messageId: string, rating: "up" | "down") => void;
}

const TABLE_SEP_RE = /\|(?:\s*:?-{3,}:?\s*\|)+/;

/**
 * Normalizes collapsed single-line GFM tables and inline Markdown headings,
 * and turns inline [1], [2] markers into interactive markdown links (#cite-1).
 */
function preprocessCitationLinks(content: string, citations: Citation[]): string {
  const withHeadings = content.replace(/([^\n])\s+(#{1,4}\s+)/g, "$1\n\n$2");
  const normalized = withHeadings
    .split("\n")
    .map((line) => {
      const match = TABLE_SEP_RE.exec(line);
      if (!match || line.trim() === match[0]) return line;
      const sep = match[0];
      const colCount = sep.split("|").length - 2;
      if (colCount < 2) return line;
      const before = line.slice(0, match.index).trim();
      const after = line.slice(match.index + sep.length).trim();
      const rows: string[] = [];
      if (before) {
        const pipeIdx = before.indexOf("|");
        if (pipeIdx > 0) {
          rows.push(before.slice(0, pipeIdx).trim(), "", before.slice(pipeIdx).trim());
        } else {
          rows.push(before);
        }
      }
      rows.push(sep);
      if (after) {
        const cells = after
          .split("|")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        let idx = 0;
        while (idx + colCount <= cells.length) {
          rows.push(`| ${cells.slice(idx, idx + colCount).join(" | ")} |`);
          idx += colCount;
        }
        if (idx < cells.length) {
          rows.push("", cells.slice(idx).join(" "));
        }
      }
      return rows.join("\n");
    })
    .join("\n");

  if (!citations.length) return normalized;
  return normalized.replace(/\[(\d+)\]/g, (full, rawNum: string) => {
    const idx = Number.parseInt(rawNum, 10);
    if (citations.some((c) => c.index === idx)) {
      return `[[${idx}]](#cite-${idx})`;
    }
    return full;
  });
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onOpenCitation,
  onFeedback,
}: MessageBubbleProps) {
  const [copiedWa, setCopiedWa] = useState(false);

  const citations = message.citations ?? [];
  const citationMap = useMemo(() => {
    const map = new Map<number, Citation>();
    for (const c of citations) {
      map.set(c.index, c);
    }
    return map;
  }, [citations]);

  const renderedMarkdown = useMemo(
    () => preprocessCitationLinks(message.content, citations),
    [message.content, citations]
  );

  if (message.role === "user") {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white shadow-xs sm:max-w-[75%] dark:bg-sky-600">
          <p className="whitespace-pre-wrap">{message.content}</p>
          <p className="mt-1.5 text-right font-mono text-[10px] text-slate-300 dark:text-sky-100">
            {message.timestamp}
          </p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <User className="h-4 w-4" />
        </div>
      </div>
    );
  }

  const isGuardrailIntervened = message.guardrailAction === "INTERVENED";

  const handleCopyWhatsApp = async () => {
    try {
      const formatted = formatForWhatsApp(message.content, citations);
      await navigator.clipboard.writeText(formatted);
      setCopiedWa(true);
      window.setTimeout(() => setCopiedWa(false), 2200);
    } catch {
      setCopiedWa(false);
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600 to-slate-900 text-white shadow-xs dark:from-sky-500 dark:to-sky-700">
        <Building2 className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-slate-200/90 bg-white p-4 shadow-xs sm:p-5 dark:border-slate-800 dark:bg-slate-900/75">
        {message.simulationSummary ? (
          <div className="mb-4 rounded-xl border border-sky-200/90 bg-sky-50/50 p-3.5 dark:border-sky-900/60 dark:bg-sky-950/25">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/70 pb-2 dark:border-sky-800/60">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                <Calculator className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                Simulação Aplicada ({message.simulationSummary.propertyLabel})
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                {message.simulationSummary.buyerAge}a +{" "}
                {(message.simulationSummary.months / 12).toFixed(1).replace(".0", "")}a ={" "}
                {message.simulationSummary.agePlusTermYears.toFixed(1).replace(".0", "")}a ≤ 80,5a
              </span>
            </div>

            <div className="mt-2.5 grid gap-2 text-[11px] sm:grid-cols-3">
              <div className="rounded-lg bg-white/80 px-2.5 py-2 dark:bg-slate-900/70">
                <p className="text-[10px] font-semibold text-slate-500 uppercase dark:text-slate-400">
                  Parâmetros ({message.simulationSummary.isSfh ? "SFH" : "SFI"})
                </p>
                <p className="mt-0.5 font-mono font-bold text-slate-900 dark:text-white">
                  {formatBRL(message.simulationSummary.propertyValue)}
                </p>
                <p className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  Entrada {message.simulationSummary.downPaymentPct}% (
                  {formatBRL(message.simulationSummary.downPayment)}) · LTV{" "}
                  {message.simulationSummary.ltv.toFixed(0)}%
                </p>
                <p className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  {message.simulationSummary.months}m ·{" "}
                  {message.simulationSummary.annualRatePct.toFixed(2).replace(".", ",")}% a.a. · ITBI
                  est. {formatBRL(message.simulationSummary.itbiEstimate)}
                </p>
              </div>

              <div className="rounded-lg bg-white/80 px-2.5 py-2 dark:bg-slate-900/70">
                <p className="text-[10px] font-semibold text-sky-700 uppercase dark:text-sky-400">
                  Sistema SAC (Menor Juros)
                </p>
                <p className="mt-0.5 font-mono font-bold text-slate-900 dark:text-white">
                  1ª: {formatBRL(message.simulationSummary.sacFirst)}
                </p>
                <p className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                  Última: {formatBRL(message.simulationSummary.sacLast)}
                </p>
                <p className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  Renda mín. (30%): {formatBRL(message.simulationSummary.sacMinIncome)}/mês
                </p>
              </div>

              <div className="rounded-lg bg-white/80 px-2.5 py-2 dark:bg-slate-900/70">
                <p className="text-[10px] font-semibold text-slate-600 uppercase dark:text-slate-300">
                  Tabela Price (Fixa)
                </p>
                <p className="mt-0.5 font-mono font-bold text-slate-900 dark:text-white">
                  Parcela: {formatBRL(message.simulationSummary.priceInstallment)}
                </p>
                <p className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                  Renda mín. (30%): {formatBRL(message.simulationSummary.priceMinIncome)}/mês
                </p>
                <p className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                  Economia SAC: {formatBRL(message.simulationSummary.savingsSac)}
                </p>
              </div>
            </div>

            {message.simulationSummary.priceExceedsLtvWarning ? (
              <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                LTV acima de 70%: bancos comerciais costumam limitar Tabela Price SBPE a 70% de LTV.
              </p>
            ) : null}
          </div>
        ) : null}

        {isGuardrailIntervened ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Amazon Bedrock Guardrail (LGPD / Grounding)</strong> protegeu esta
              interação.
            </span>
          </div>
        ) : null}

        <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h3 className="mt-3 mb-2 text-base font-bold text-slate-900 dark:text-white">
                  {children}
                </h3>
              ),
              h2: ({ children }) => (
                <h4 className="mt-3 mb-1.5 text-sm font-bold text-slate-900 dark:text-white">
                  {children}
                </h4>
              ),
              h3: ({ children }) => (
                <h5 className="mt-2.5 mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {children}
                </h5>
              ),
              p: ({ children }) => (
                <p className="mb-2.5 text-sm leading-relaxed text-slate-800 last:mb-0 dark:text-slate-200">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-slate-800 dark:text-slate-200">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-800 dark:text-slate-200">
                  {children}
                </ol>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-slate-950 dark:text-white">
                  {children}
                </strong>
              ),
              table: ({ children }) => (
                <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-700">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-slate-50 text-left font-semibold text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                  {children}
                </thead>
              ),
              th: ({ children }) => <th className="px-3 py-2">{children}</th>,
              td: ({ children }) => (
                <td className="border-t border-slate-100 px-3 py-2 text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  {children}
                </td>
              ),
              a: ({ href, children }) => {
                if (href?.startsWith("#cite-")) {
                  const idx = Number.parseInt(href.replace("#cite-", ""), 10);
                  const found = citationMap.get(idx);
                  if (found) {
                    const pageTag = found.pagina ? ` · p.${found.pagina}` : "";
                    const tooltip = `Inspecionar ${found.codigo_doc} — ${found.titulo}${
                      found.pagina ? ` (Página ${found.pagina})` : ""
                    }`;
                    return (
                      <button
                        type="button"
                        onClick={() => onOpenCitation(found)}
                        title={tooltip}
                        className="mx-0.5 inline-flex items-center rounded-md bg-sky-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-sky-800 transition-colors hover:bg-sky-600 hover:text-white dark:bg-sky-950 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-white"
                      >
                        [{found.index}
                        {pageTag}]
                      </button>
                    );
                  }
                }
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sky-700 underline dark:text-sky-400"
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {renderedMarkdown}
          </ReactMarkdown>
        </div>

        {/* Clickable Official Citations Strip */}
        {citations.length > 0 ? (
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Fontes Oficiais Consultadas (documento e página · clique para abrir o PDF)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {citations.map((c) => {
                const fileName = c.arquivo || c.s3_key?.split("/").pop() || "";
                return (
                  <button
                    key={`${message.id}-cite-${c.index}`}
                    type="button"
                    onClick={() => onOpenCitation(c)}
                    className="group flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/90 p-2.5 text-left transition-all hover:border-sky-500 hover:bg-sky-50/70 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:border-sky-500 dark:hover:bg-sky-950/40"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-sky-600 shadow-2xs ring-1 ring-slate-200/80 group-hover:bg-sky-600 group-hover:text-white dark:bg-slate-900 dark:text-sky-400 dark:ring-slate-700">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                          [{c.index}] {c.codigo_doc}
                        </span>
                        {c.pagina ? (
                          <span className="rounded-md bg-sky-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                            Pág. {c.pagina}
                          </span>
                        ) : null}
                        {c.versao ? (
                          <span className="font-mono text-[10px] text-slate-400">
                            v{c.versao}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-700 group-hover:text-sky-900 dark:text-slate-200 dark:group-hover:text-sky-200">
                        {c.titulo}
                      </p>
                      {fileName ? (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          {fileName}
                        </p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Broker Action Toolbar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
            >
              {copiedWa ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Copiado p/ WhatsApp!
                </>
              ) : (
                <>
                  <MessageSquareShare className="h-3.5 w-3.5" />
                  Copiar p/ WhatsApp
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onFeedback(message.id, "up")}
              aria-label="Resposta útil"
              className={`rounded-lg border p-1.5 transition-colors ${
                message.feedback === "up"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : "border-slate-200 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onFeedback(message.id, "down")}
              aria-label="Reportar melhoria"
              className={`rounded-lg border p-1.5 transition-colors ${
                message.feedback === "down"
                  ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                  : "border-slate-200 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:hover:text-slate-200"
              }`}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2.5 font-mono text-[10px]">
            {typeof message.latencyMs === "number" ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {(message.latencyMs / 1000).toFixed(1)}s
              </span>
            ) : null}
            <span>{message.timestamp}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
