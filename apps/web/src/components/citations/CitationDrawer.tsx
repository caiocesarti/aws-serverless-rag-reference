"use client";

import { ExternalLink, FileText, Lock, ShieldCheck, X } from "lucide-react";

import type { Citation } from "@/lib/types";

interface CitationDrawerProps {
  citation: Citation | null;
  onClose: () => void;
}

const SAFE_DEMO_PDF_PATH_RE = /^\/api\/demo-pdf\?doc=IMOBI-(?:EMP-001|COND-002|FIN-003)$/;

export function CitationDrawer({ citation, onClose }: CitationDrawerProps) {
  if (!citation) return null;

  const pdfUrl = citation.presigned_url
    ? citation.pagina
      ? `${citation.presigned_url}#page=${citation.pagina}`
      : citation.presigned_url
    : null;
  const safeDemoPdfBase =
    !pdfUrl && citation.demo_pdf_url && SAFE_DEMO_PDF_PATH_RE.test(citation.demo_pdf_url)
      ? citation.demo_pdf_url
      : null;
  const demoPdfHref = safeDemoPdfBase
    ? citation.pagina
      ? `${safeDemoPdfBase}#page=${citation.pagina}`
      : safeDemoPdfBase
    : null;
  const displayFileName =
    citation.arquivo || citation.s3_key?.split("/").pop() || citation.s3_key || "documento.pdf";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0D1320]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white dark:bg-sky-500/20 dark:text-sky-300">
                  [{citation.index}] {citation.codigo_doc}
                </span>
                {citation.pagina ? (
                  <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    Página {citation.pagina}
                  </span>
                ) : null}
                {citation.versao ? (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    v{citation.versao}
                  </span>
                ) : null}
                {citation.vigencia ? (
                  <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    Vigência: {citation.vigencia}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                {citation.titulo}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar inspetor de documento"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Security Assurance Strip */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-emerald-50/70 px-5 py-2.5 text-[11px] text-emerald-900 dark:border-slate-800 dark:bg-emerald-950/30 dark:text-emerald-200">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            {pdfUrl
              ? "S3 Privado · Pre-signed URL temporária (10 min · SigV4)"
              : demoPdfHref
                ? "Modo Portfólio (FinOps) · Metadados e trecho verificados da KB oficial"
                : "S3 Privado · Metadados e trecho recuperados da KB oficial"}
          </span>
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-sky-700 hover:underline dark:text-sky-400"
            >
              Abrir PDF{citation.pagina ? ` (Pág. ${citation.pagina})` : ""}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>

        {/* Snippet + PDF Preview */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {citation.snippet ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-amber-800 uppercase dark:text-amber-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Trecho Recuperado{citation.pagina ? ` · Página ${citation.pagina}` : ""} (Pinecone + Cohere Rerank 3.5)
              </p>
              <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                “{citation.snippet}…”
              </p>
            </div>
          ) : null}

          {pdfUrl ? (
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <span className="truncate font-mono">{displayFileName}</span>
                <span className="shrink-0 font-semibold">
                  {citation.pagina ? `PDF Oficial · Pág. ${citation.pagina}` : "PDF Oficial"}
                </span>
              </div>
              <iframe
                key={`${citation.s3_key ?? citation.codigo_doc}-p${citation.pagina ?? 1}`}
                src={pdfUrl}
                title={`${citation.titulo}${citation.pagina ? ` — Página ${citation.pagina}` : ""}`}
                className="min-h-[420px] w-full flex-1 bg-white"
              />
            </div>
          ) : demoPdfHref ? (
            <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/50 p-6 text-center dark:border-sky-900/60 dark:bg-sky-950/20">
              <span className="inline-flex items-center rounded-full border border-amber-300/80 bg-amber-100/80 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-amber-900 uppercase dark:border-amber-700/70 dark:bg-amber-950/60 dark:text-amber-200">
                Exclusivo do Modo Demo · Não existe em produção AWS
              </span>
              <p className="mt-3 text-xs font-bold text-slate-800 dark:text-slate-100">
                Pré-visualização S3 em Standby (Modo Portfólio FinOps)
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Documento oficial <span className="font-mono font-semibold">{displayFileName}</span>
                {citation.pagina ? ` (Página ${citation.pagina})` : ""}.
              </p>
              <div className="mt-4 flex justify-center">
                <a
                  href={demoPdfHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Conferir PDF da Base{citation.pagina ? ` (Pág. ${citation.pagina})` : ""}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Este atalho lê a cópia pública da base apenas com{" "}
                <span className="font-mono font-semibold">DEMO_MODE=true</span>. Em produção AWS (
                <span className="font-mono font-semibold">DEMO_MODE=false</span>), a rota{" "}
                <span className="font-mono">/api/demo-pdf</span> retorna{" "}
                <span className="font-mono font-semibold">404</span> e este painel exibe o PDF
                direto do bucket S3 privado via Pre-signed URL SigV4 (10 min).
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Pré-visualização S3 temporariamente indisponível
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Documento oficial <span className="font-mono font-semibold">{displayFileName}</span>
                {citation.pagina ? ` (Página ${citation.pagina})` : ""}. Tente refazer a consulta
                para gerar uma nova Pre-signed URL temporária (SigV4 · 10 min).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
