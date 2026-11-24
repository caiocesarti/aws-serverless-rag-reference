"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Calculator, CheckCircle2, Sparkles, X } from "lucide-react";

import { ALL_TIPOLOGIAS, formatBRL, type TipologiaSpec } from "@/lib/portfolio";

interface SacPriceSimulatorModalProps {
  open: boolean;
  initialTipologia: TipologiaSpec | null;
  onClose: () => void;
  onAskAi: (prompt: string) => void;
}

const SFH_CEILING = 1_500_000;

export function SacPriceSimulatorModal({
  open,
  initialTipologia,
  onClose,
  onAskAi,
}: SacPriceSimulatorModalProps) {
  const defaultTip = initialTipologia ?? ALL_TIPOLOGIAS[3]!; // Parque das Palmeiras Tipo 2Q (R$ 612k)
  const [selectedId, setSelectedId] = useState<string>(defaultTip.id);
  const [propertyValue, setPropertyValue] = useState<number>(defaultTip.precoBase);
  const [downPaymentPct, setDownPaymentPct] = useState<number>(20);
  const [annualRatePct, setAnnualRatePct] = useState<number>(10.5);
  const [months, setMonths] = useState<number>(360);
  const [buyerAge, setBuyerAge] = useState<number>(35);

  const selectedTipologia = useMemo(
    () => ALL_TIPOLOGIAS.find((t) => t.id === selectedId) ?? null,
    [selectedId]
  );

  // Max term rule from IMOBI-FIN-003 (80 years and 6 months = 966 months)
  const maxAllowedMonthsByAge = Math.max(12, Math.min(420, Math.floor((80.5 - buyerAge) * 12)));
  const effectiveMonths = Math.min(months, maxAllowedMonthsByAge);

  const calc = useMemo(() => {
    const downPayment = propertyValue * (downPaymentPct / 100);
    const financed = Math.max(0, propertyValue - downPayment);
    const ltv = propertyValue > 0 ? (financed / propertyValue) * 100 : 0;
    const isSfh = propertyValue <= SFH_CEILING;

    const monthlyRate = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
    // Reference admin fee R$ 25 + estimated DFI (0.02%/mo) + average MIP
    const monthlyFeesAndInsurance = 25 + propertyValue * 0.0002 + financed * 0.00035;

    // SAC
    const sacAmort = effectiveMonths > 0 ? financed / effectiveMonths : 0;
    const sacFirst = sacAmort + financed * monthlyRate + monthlyFeesAndInsurance;
    const sacLast = sacAmort + sacAmort * monthlyRate + monthlyFeesAndInsurance;
    const sacTotal =
      financed +
      ((financed * monthlyRate * (effectiveMonths + 1)) / 2) +
      monthlyFeesAndInsurance * effectiveMonths;

    // Price
    const priceBase =
      monthlyRate > 0
        ? (financed * (monthlyRate * Math.pow(1 + monthlyRate, effectiveMonths))) /
          (Math.pow(1 + monthlyRate, effectiveMonths) - 1)
        : sacAmort;
    const priceInstallment = priceBase + monthlyFeesAndInsurance;
    const priceTotal = priceInstallment * effectiveMonths;

    return {
      downPayment,
      financed,
      ltv,
      isSfh,
      sacFirst,
      sacLast,
      sacMinIncome: sacFirst / 0.3,
      sacTotal,
      priceInstallment,
      priceMinIncome: priceInstallment / 0.3,
      priceTotal,
      savingsSac: Math.max(0, priceTotal - sacTotal),
      priceExceedsLtvWarning: ltv > 70,
      sacExceedsLtvWarning: ltv > 80,
      itbiEstimate: propertyValue * 0.03,
    };
  }, [propertyValue, downPaymentPct, annualRatePct, effectiveMonths]);

  if (!open) return null;

  const handleTipologiaChange = (id: string) => {
    setSelectedId(id);
    const found = ALL_TIPOLOGIAS.find((t) => t.id === id);
    if (found) {
      setPropertyValue(found.precoBase);
      if (found.precoBase > SFH_CEILING) {
        setAnnualRatePct(11.49);
      } else if (found.precoBase <= 350000) {
        setAnnualRatePct(8.16);
      } else {
        setAnnualRatePct(10.5);
      }
    }
  };

  const handleAskConsultant = () => {
    const label = selectedTipologia
      ? `${selectedTipologia.empreendimentoNome} — ${selectedTipologia.nome}`
      : `imóvel de ${formatBRL(propertyValue)}`;
    onAskAi(
      `Para um cliente de ${buyerAge} anos interessado no ${label} (${formatBRL(
        propertyValue
      )}), com entrada de ${downPaymentPct}% (${formatBRL(
        calc.downPayment
      )}) e financiamento em ${effectiveMonths} meses, quais linhas de crédito do Manual IMOBI-FIN-003 se enquadram (SFH/SFI/MCMV/Pró-Cotista), pode usar FGTS e quais os custos de ITBI e registro em Salvador?`
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulator-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0D1320]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="simulator-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Simulador Comparativo SAC vs. Tabela Price
              </h2>
              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Parâmetros oficiais · Manual IMOBI-FIN-003 v4.0 (Regra 30% + 80a6m)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar simulador"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Tipologia preset */}
          <div>
            <label
              htmlFor="sim-tipologia"
              className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Unidade de Referência do Portfólio ImobiSmart
            </label>
            <select
              id="sim-tipologia"
              value={selectedId}
              onChange={(e) => handleTipologiaChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {ALL_TIPOLOGIAS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.empreendimentoNome} — {t.nome} ({t.privativaTotalM2} m² ·{" "}
                  {formatBRL(t.precoBase)})
                </option>
              ))}
            </select>
          </div>

          {/* Sliders grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Entrada (%)
                </span>
                <span className="font-mono font-bold text-sky-700 dark:text-sky-400">
                  {downPaymentPct}% ({formatBRL(calc.downPayment)})
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={70}
                step={5}
                value={downPaymentPct}
                onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                className="mt-2 w-full accent-sky-600"
              />
              <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Financiado (LTV {calc.ltv.toFixed(0)}%): {formatBRL(calc.financed)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Taxa Efetiva (a.a. + TR)
                </span>
                <span className="font-mono font-bold text-sky-700 dark:text-sky-400">
                  {annualRatePct.toFixed(2).replace(".", ",")}% a.a.
                </span>
              </div>
              <input
                type="range"
                min={7.5}
                max={13.0}
                step={0.1}
                value={annualRatePct}
                onChange={(e) => setAnnualRatePct(Number(e.target.value))}
                className="mt-2 w-full accent-sky-600"
              />
              <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Ref.: Pró-Cotista 8,66% · SBPE TR 10,49–11,49%
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Prazo (meses)
                </span>
                <span className="font-mono font-bold text-sky-700 dark:text-sky-400">
                  {effectiveMonths}m ({(effectiveMonths / 12).toFixed(1)} anos)
                </span>
              </div>
              <input
                type="range"
                min={60}
                max={maxAllowedMonthsByAge}
                step={12}
                value={effectiveMonths}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="mt-2 w-full accent-sky-600"
              />
              <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Teto pela idade ({buyerAge}a): {maxAllowedMonthsByAge} meses
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Idade do Proponente Mais Velho
                </span>
                <span className="font-mono font-bold text-sky-700 dark:text-sky-400">
                  {buyerAge} anos
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={75}
                step={1}
                value={buyerAge}
                onChange={(e) => setBuyerAge(Number(e.target.value))}
                className="mt-2 w-full accent-sky-600"
              />
              <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Regra bancária: idade + prazo ≤ 80 anos e 6 meses
              </p>
            </div>
          </div>

          {/* Enquadramento Strip */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-900">
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold ${
                calc.isSfh
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {calc.isSfh ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {calc.isSfh ? "Enquadrado no SFH (Aceita FGTS)" : "Enquadrado no SFI (Sem FGTS)"}
            </span>
            {calc.isSfh ? (
              <span className="rounded-lg bg-sky-100 px-2 py-1 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                50% desc. RGI (1º imóvel · Lei 6.015/73)
              </span>
            ) : null}
            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
              ITBI Salvador est. (3%): {formatBRL(calc.itbiEstimate)}
            </span>
          </div>

          {/* Comparison Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-sky-500/70 bg-sky-50/40 p-4 dark:border-sky-500/40 dark:bg-sky-950/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Sistema SAC
                </span>
                <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  Menor Juros Total
                </span>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-600 dark:text-slate-400">1ª Prestação Est.</dt>
                  <dd className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatBRL(calc.sacFirst)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600 dark:text-slate-400">Última Prestação</dt>
                  <dd className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatBRL(calc.sacLast)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600 dark:text-slate-400">Renda Mínima (30%)</dt>
                  <dd className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatBRL(calc.sacMinIncome)}/mês
                  </dd>
                </div>
                <div className="flex justify-between border-t border-sky-200/70 pt-2 dark:border-sky-800/60">
                  <dt className="text-slate-600 dark:text-slate-400">Total Aproximado</dt>
                  <dd className="font-mono font-bold text-sky-800 dark:text-sky-300">
                    {formatBRL(calc.sacTotal)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Tabela Price
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Parcela Fixa
                </span>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-600 dark:text-slate-400">1ª Prestação Est.</dt>
                  <dd className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatBRL(calc.priceInstallment)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600 dark:text-slate-400">Última Prestação</dt>
                  <dd className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {formatBRL(calc.priceInstallment)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600 dark:text-slate-400">Renda Mínima (30%)</dt>
                  <dd className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {formatBRL(calc.priceMinIncome)}/mês
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-800">
                  <dt className="text-slate-600 dark:text-slate-400">Total Aproximado</dt>
                  <dd className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatBRL(calc.priceTotal)}
                  </dd>
                </div>
              </dl>
              {calc.priceExceedsLtvWarning ? (
                <p className="mt-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  ⚠️ Atenção: bancos comerciais costumam limitar Tabela Price SBPE a 70% de LTV.
                </p>
              ) : null}
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Economia estimada no SAC vs. Price:{" "}
            <strong className="font-mono text-emerald-700 dark:text-emerald-400">
              {formatBRL(calc.savingsSac)}
            </strong>{" "}
            ao longo do contrato. Valores estimativos sujeitos à análise de crédito, variação de TR
            e tabela vigente.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleAskConsultant}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Validar Regras com o ImobiSmart AI
          </button>
        </div>
      </div>
    </div>
  );
}
