import type { Citation } from "./types";

/**
 * Converts Markdown response into clean, ready-to-paste WhatsApp text for real estate brokers.
 */
export function formatForWhatsApp(markdown: string, citations?: Citation[]): string {
  let text = markdown
    // Remove inline [1] markers for cleaner client reading
    .replace(/\s*\[\d+\]/g, "")
    // Convert markdown headings (### Title) to WhatsApp bold
    .replace(/^#{1,6}\s+(.+)$/gm, "\n*$1*")
    // Convert markdown **bold** to WhatsApp *bold*
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    // Normalize bullet dashes to clean dots
    .replace(/^[-*]\s+/gm, "• ")
    // Clean excessive blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (citations && citations.length > 0) {
    const sources = citations
      .map((c) => {
        const metaParts = [
          c.versao ? `v${c.versao}` : "",
          c.pagina ? `Pág. ${c.pagina}` : "",
        ].filter(Boolean);
        const suffix = metaParts.length > 0 ? ` (${metaParts.join(" · ")})` : "";
        return `• ${c.codigo_doc}${suffix} — ${c.titulo}`;
      })
      .join("\n");
    text += `\n\n_Base técnica oficial ImobiSmart:_\n${sources}`;
  }

  return `🏢 *ImobiSmart — Resumo Técnico*\n\n${text}`;
}
