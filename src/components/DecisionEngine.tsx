"use client";

import Image from "next/image";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  CircleDollarSign,
  Gauge,
  LineChart as LineChartIcon,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  calculateDecisionMetrics,
  type ExecutiveMode,
  formatCurrency,
  formatPercent,
  type ScenarioInputs,
  type RiskFlag,
} from "@/lib/decisionLogic";
import {
  businessScenarioPresets,
  defaultOperatingAssumptions,
  type OperatingAssumptions,
} from "@/lib/sampleData";

type ExecutiveStatus = "stable" | "watch" | "pressure" | "critical";
type DataMode = "Demo Mode" | "Live Input Mode";

const baseInputs: ScenarioInputs = {
  revenueChange: 0,
  expenseChange: 0,
  collectionDelayChange: 0,
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

const riskFlagLabels: RiskFlag[] = [
  "Negative Cash Flow",
  "Runway Under 6 Months",
  "High Client Concentration",
  "Expense Ratio Over 70%",
  "Collections Delay Pressure",
];

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

async function loadImageAsDataUrl(src: string) {
  const response = await fetch(src);
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function DecisionEngine() {
  const [inputs, setInputs] = useState<ScenarioInputs>(baseInputs);
  const [dataMode, setDataMode] = useState<DataMode>("Demo Mode");
  const [liveAssumptions, setLiveAssumptions] = useState<OperatingAssumptions>(
    defaultOperatingAssumptions,
  );
  const [executiveMode, setExecutiveMode] = useState<ExecutiveMode>("Balanced");
  const [isPending, startTransition] = useTransition();
  const [chartsReady, setChartsReady] = useState(false);
  const assumptions =
    dataMode === "Demo Mode" ? defaultOperatingAssumptions : liveAssumptions;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setChartsReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const metrics = useMemo(
    () => calculateDecisionMetrics(inputs, assumptions, executiveMode),
    [assumptions, executiveMode, inputs],
  );

  const scenarioData = useMemo(() => {
    const cases = [
      { name: "Base", inputs },
      {
        name: "Upside",
        inputs: {
          revenueChange: Math.min(inputs.revenueChange + 15, 30),
          expenseChange: Math.max(inputs.expenseChange - 8, -30),
          collectionDelayChange: Math.max(inputs.collectionDelayChange - 10, -20),
        },
      },
      {
        name: "Stress",
        inputs: {
          revenueChange: Math.max(inputs.revenueChange - 18, -30),
          expenseChange: Math.min(inputs.expenseChange + 12, 30),
          collectionDelayChange: Math.min(inputs.collectionDelayChange + 15, 30),
        },
      },
    ];

    return cases.map((item) => {
      const result = calculateDecisionMetrics(item.inputs, assumptions, executiveMode);
      return {
        name: item.name,
        revenue: result.adjustedRevenue,
        expenses: result.adjustedExpenses,
        cashFlow: result.netCashFlow,
        score: result.healthScore,
      };
    });
  }, [assumptions, executiveMode, inputs]);

  const forecastData = useMemo(() => {
    const rows = [];
    let cash = assumptions.currentCash;

    for (let month = 0; month <= 6; month += 1) {
      if (month > 0) cash += metrics.netCashFlow;
      rows.push({
        month: month === 0 ? "Now" : `M+${month}`,
        cash: Math.max(cash, 0),
        minimumSafe: assumptions.minimumSafeCash,
      });
    }

    return rows;
  }, [assumptions.currentCash, assumptions.minimumSafeCash, metrics.netCashFlow]);

  const expenseBreakdown = [
    { name: "Fixed", value: assumptions.fixedExpenses, color: "#0b1628" },
    { name: "Variable", value: assumptions.variableExpenses, color: "#c9972f" },
  ];
  const fixedExpenseShare = assumptions.fixedExpenses / metrics.totalExpenses;

  const arData = [
    {
      name: "Current AR delay",
      days: assumptions.arDays,
      cash: (metrics.adjustedRevenue / 30) * assumptions.arDays,
    },
    {
      name: "Scenario delay",
      days: metrics.adjustedCollectionDays,
      cash: metrics.cashDelayed,
    },
  ];

  const runwayLabel =
    metrics.runwayMonths === null
      ? "Surplus"
      : `${numberFormatter.format(metrics.runwayMonths)} mo`;
  const executiveStatus = getExecutiveStatus(metrics);
  const benchmarkRows = getBenchmarkRows(metrics);
  const scenarioChangeSummary = getScenarioChangeSummary(metrics);
  const impactModel = useMemo(
    () => getImpactModel(inputs, assumptions, executiveMode, metrics),
    [assumptions, executiveMode, inputs, metrics],
  );
  const executiveBriefing = getExecutiveBriefing(metrics, impactModel);
  const scenarioComparison = useMemo(
    () => getScenarioComparison(inputs, assumptions),
    [assumptions, inputs],
  );
  const benchmarkIntelligence = getBenchmarkIntelligence(metrics, assumptions);
  const cashPressureSummary = getCashPressureSummary(metrics, runwayLabel);
  const revenueHistory = useMemo(
    () => [
      { month: "Month -3", amount: Math.round(assumptions.monthlyRevenue * 0.92) },
      { month: "Month -2", amount: Math.round(assumptions.monthlyRevenue * 1.08) },
      { month: "Month -1", amount: assumptions.monthlyRevenue },
    ],
    [assumptions.monthlyRevenue],
  );

  function updateAssumption(key: keyof OperatingAssumptions, value: number) {
    startTransition(() => {
      setDataMode("Live Input Mode");
      setLiveAssumptions((current) => ({
        ...current,
        [key]: Math.max(0, value),
      }));
    });
  }

  function applyPreset(preset: OperatingAssumptions) {
    startTransition(() => {
      setDataMode("Live Input Mode");
      setLiveAssumptions(preset);
    });
  }

  function updateDataMode(mode: DataMode) {
    startTransition(() => {
      setDataMode(mode);
      if (mode === "Live Input Mode") {
        setLiveAssumptions((current) => current);
      }
    });
  }

  function updateInputs(updater: (current: ScenarioInputs) => ScenarioInputs) {
    startTransition(() => {
      setInputs(updater);
    });
  }

  async function handleExportSummary() {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 44;
    const contentWidth = pageWidth - margin * 2;
    let y = 42;

    const navy = "#071426";
    const gold = "#b8913b";
    const slate = "#314155";
    const muted = "#657386";
    const panel = "#f8fafc";
    const line = "#d7dde5";

    const ensureSpace = (height: number) => {
      if (y + height > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const removeArtificialLetterSpacing = (text: string) =>
      text
        .split(/\s{2,}/)
        .map((segment) => {
          const tokens = segment.trim().split(/\s+/);
          const singleCharacterTokens = tokens.filter((token) =>
            /^[A-Za-z0-9]$/.test(token),
          ).length;
          const appearsLetterSpaced =
            tokens.length >= 3 && singleCharacterTokens / tokens.length >= 0.75;

          if (!appearsLetterSpaced) return segment.trim();

          return tokens.reduce((rebuilt, token) => {
            if (/^[A-Za-z0-9]$/.test(token)) return `${rebuilt}${token}`;
            if (/^[.,:;!?)]$/.test(token)) return `${rebuilt}${token}`;
            return `${rebuilt}${rebuilt ? " " : ""}${token}`;
          }, "");
        })
        .join(" ");

    const normalizePdfText = (text: string) =>
      removeArtificialLetterSpacing(text).replace(/\s+/g, " ").trim();

    const setPdfTextStyle = ({
      size,
      color,
      bold = false,
    }: {
      size: number;
      color: string;
      bold?: boolean;
    }) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(color);
      doc.setCharSpace(0);
    };

    const splitPdfText = (text: string, maxWidth: number, size: number, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setCharSpace(0);
      return doc.splitTextToSize(normalizePdfText(text), maxWidth) as string[];
    };

    const addWrappedText = (
      text: string,
      x: number,
      maxWidth: number,
      options: { size?: number; color?: string; lineHeight?: number; bold?: boolean } = {},
    ) => {
      const size = options.size ?? 10;
      const lineHeight = options.lineHeight ?? size + 5;
      const color = options.color ?? slate;
      const bold = options.bold ?? false;
      setPdfTextStyle({ size, color, bold });
      const lines = splitPdfText(text, maxWidth, size, bold);
      ensureSpace(lines.length * lineHeight + 4);
      setPdfTextStyle({ size, color, bold });
      doc.text(lines, x, y, { lineHeightFactor: lineHeight / size });
      y += lines.length * lineHeight;
    };

    const addSection = (title: string) => {
      ensureSpace(34);
      y += 14;
      doc.setDrawColor(gold);
      doc.setLineWidth(1.5);
      doc.line(margin, y, margin + 42, y);
      y += 16;
      setPdfTextStyle({ size: 10, color: navy, bold: true });
      doc.text(title.toUpperCase(), margin, y);
      y += 16;
    };

    const drawMetricBox = (label: string, value: string, x: number, boxY: number, width: number) => {
      doc.setFillColor(panel);
      doc.setDrawColor(line);
      doc.roundedRect(x, boxY, width, 54, 6, 6, "FD");
      setPdfTextStyle({ size: 7.5, color: muted, bold: true });
      doc.text(label.toUpperCase(), x + 10, boxY + 18);
      setPdfTextStyle({ size: 13, color: navy, bold: true });
      doc.text(value, x + 10, boxY + 39);
    };

    const addRecommendationBox = (recommendation: (typeof metrics.recommendations)[number]) => {
      const boxPadding = 12;
      const innerWidth = contentWidth - boxPadding * 2;
      const titleSize = 10;
      const bodySize = 8.5;
      const titleLineHeight = 13;
      const bodyLineHeight = 11;
      const titleLines = splitPdfText(
        `P${recommendation.priority}: ${recommendation.title}`,
        innerWidth,
        titleSize,
        true,
      );
      const targetLines = splitPdfText(`Target: ${recommendation.target}`, innerWidth, bodySize);
      const actionLines = splitPdfText(`Action: ${recommendation.action}`, innerWidth, bodySize);
      const boxHeight =
        boxPadding * 2 +
        titleLines.length * titleLineHeight +
        targetLines.length * bodyLineHeight +
        actionLines.length * bodyLineHeight +
        8;

      ensureSpace(boxHeight + 10);
      const boxY = y;
      doc.setFillColor(panel);
      doc.setDrawColor(line);
      doc.roundedRect(margin, boxY, contentWidth, boxHeight, 6, 6, "FD");

      y = boxY + boxPadding + titleSize;
      setPdfTextStyle({ size: titleSize, color: navy, bold: true });
      doc.text(titleLines, margin + boxPadding, y, {
        lineHeightFactor: titleLineHeight / titleSize,
      });
      y += titleLines.length * titleLineHeight + 2;

      setPdfTextStyle({ size: bodySize, color: slate });
      doc.text(targetLines, margin + boxPadding, y, {
        lineHeightFactor: bodyLineHeight / bodySize,
      });
      y += targetLines.length * bodyLineHeight + 2;

      setPdfTextStyle({ size: bodySize, color: muted });
      doc.text(actionLines, margin + boxPadding, y, {
        lineHeightFactor: bodyLineHeight / bodySize,
      });
      y = boxY + boxHeight + 10;
    };

    const logo = await loadImageAsDataUrl("/KOSYME_Logo_250.png");
    const longTextWidth = contentWidth - 36;
    const plainCashPressureSummary = normalizePdfText(cashPressureSummary);
    const plainBenchmarkSummary = normalizePdfText(benchmarkIntelligence.summary);
    const plainExecutiveBriefing = getPdfExecutiveBriefing(metrics, assumptions).map((sentence) =>
      normalizePdfText(sentence),
    );
    const plainRecommendations = metrics.recommendations.map((recommendation) => ({
      priority: recommendation.priority,
      title: normalizePdfText(recommendation.title),
      target: normalizePdfText(recommendation.target),
      action: normalizePdfText(recommendation.action),
    }));
    const plainDisclaimer = normalizePdfText(
      "Enterprise Decision Engine(TM) is a proprietary financial analysis and scenario modeling system developed by KOSYME Financial Services LLC. This export is provided for informational and educational demonstration purposes only and does not constitute investment advice, legal advice, tax advice, accounting assurance services, or licensed financial advisory services. All forecasts, projections, risk indicators, scenario outputs, and executive recommendations are illustrative in nature and should not be relied upon as the sole basis for financial decision-making.",
    );
    const plainCopyright = normalizePdfText(
      "(C) 2026 KOSYME Financial Services LLC. All rights reserved.",
    );

    doc.setFillColor("#ffffff");
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.addImage(logo, "PNG", pageWidth - margin - 118, y - 4, 118, 40);
    setPdfTextStyle({ size: 9, color: gold, bold: true });
    doc.text("KOSYME FINANCIAL SERVICES LLC", margin, y);
    y += 22;
    setPdfTextStyle({ size: 24, color: navy, bold: true });
    doc.text("Enterprise Decision Engine", margin, y);
    y += 18;
    setPdfTextStyle({ size: 12, color: slate, bold: true });
    doc.text("Executive Summary", margin, y);
    y += 20;
    doc.setDrawColor(gold);
    doc.setLineWidth(2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 24;

    const boxGap = 10;
    const boxWidth = (contentWidth - boxGap) / 2;
    drawMetricBox("Company mode status", dataMode, margin, y, boxWidth);
    drawMetricBox("System status", formatStatus(executiveStatus), margin + boxWidth + boxGap, y, boxWidth);
    y += 64;
    drawMetricBox("Financial health score", `${metrics.healthScore}`, margin, y, boxWidth);
    drawMetricBox("Cash / runway position", runwayLabel, margin + boxWidth + boxGap, y, boxWidth);
    y += 62;

    addSection("Cash Pressure Summary");
    addWrappedText(plainCashPressureSummary, margin, longTextWidth, { size: 10.5 });

    addSection("Active Risk Flags");
    addWrappedText(
      metrics.riskFlags.length > 0
        ? metrics.riskFlags.join(" | ")
        : "No active risk flags are currently present.",
      margin,
      contentWidth,
      { size: 10.5, color: navy, bold: true },
    );

    addSection("Benchmark Summary");
    addWrappedText(plainBenchmarkSummary, margin, longTextWidth, { size: 10.5 });

    addSection("Executive Briefing");
    plainExecutiveBriefing.forEach((sentence) => {
      addWrappedText(sentence, margin, longTextWidth, { size: 10 });
      y += 3;
    });

    addSection("Recommended Actions");
    plainRecommendations.forEach((recommendation) => {
      addRecommendationBox(recommendation);
    });

    addSection("Proprietary Disclaimer");
    addWrappedText(
      plainDisclaimer,
      margin,
      longTextWidth,
      { size: 8.5, color: muted, lineHeight: 12 },
    );
    addWrappedText(
      plainCopyright,
      margin,
      longTextWidth,
      { size: 8.5, color: navy, bold: true, lineHeight: 12 },
    );

    doc.save("KOSYME-Enterprise-Decision-Engine-Summary.pdf");
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-white/10 bg-[#061426] text-white shadow-[0_18px_60px_rgba(6,20,38,0.18)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="inline-flex w-fit items-center gap-4 rounded-md">
              <div className="flex h-14 items-center rounded-lg border border-white/70 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(6,20,38,0.18)]">
                <Image
                  src="/KOSYME_Logo_250.png"
                  alt="KOSYME Financial Services"
                  width={250}
                  height={84}
                  className="h-full w-auto object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-semibold tracking-normal text-white sm:text-[2rem]">
                Enterprise Decision Engine
              </h1>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-sm shadow-sm sm:grid-cols-4 lg:mt-3">
              <HeaderStat label="Revenue" value={formatCurrency(metrics.latestRevenue)} />
              <HeaderStat label="Expenses" value={formatCurrency(metrics.totalExpenses)} />
              <HeaderStat label="Cash" value={formatCurrency(assumptions.currentCash)} />
              <HeaderStat label="AR Days" value={`${metrics.adjustedCollectionDays}d`} />
            </div>
          </div>

          <section className="grid items-start gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex h-full flex-col justify-between rounded-3xl border border-slate-700/60 bg-slate-900/70 p-8 shadow-sm">
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-amber-400">
                    Master Executive Dashboard
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold leading-tight text-white">
                    Enterprise Financial Pressure Monitoring
                  </h2>
                </div>

                <p className="max-w-2xl text-base leading-7 text-slate-300">
                  Operating data translated into liquidity forecasts, collection pressure analysis,
                  concentration risk indicators, and executive-level operating recommendations.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Health</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-400">
                    {metrics.healthRating}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Risk Flags</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {metrics.riskFlags.length} Active
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Cash Pressure
                  </p>
                  <p
                    className={clsx(
                      "mt-2 text-2xl font-semibold",
                      metrics.riskFlags.includes("Negative Cash Flow") ||
                        metrics.riskFlags.includes("Collections Delay Pressure")
                        ? "text-red-400"
                        : "text-emerald-300",
                    )}
                  >
                    {metrics.riskFlags.includes("Negative Cash Flow") ||
                    metrics.riskFlags.includes("Collections Delay Pressure")
                      ? "Elevated"
                      : "Controlled"}
                  </p>
                </div>
              </div>
            </div>
            <HealthScore
              score={metrics.healthScore}
              rating={metrics.healthRating}
              drivers={metrics.healthScoreDrivers}
            />
          </section>

          <div
            className={clsx(
              "rounded-xl border px-4 py-3 shadow-sm",
              metrics.alert.level === "critical" &&
                "border-red-200 bg-white text-[var(--danger)]",
              metrics.alert.level === "watch" &&
                "border-[var(--gold)]/45 bg-white text-[var(--navy)]",
              metrics.alert.level === "stable" &&
                "border-emerald-200 bg-white text-emerald-900",
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert size={20} />
                <p className="text-sm font-semibold uppercase tracking-[0.16em]">
                  {metrics.alert.headline}
                </p>
              </div>
              <p className="text-sm leading-6 sm:max-w-2xl">{metrics.alert.message}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-5 pt-7 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<CircleDollarSign size={20} />}
            label="Net Cash Flow"
            value={formatCurrency(metrics.netCashFlow)}
            status={metrics.netCashFlow >= 10000 ? "stable" : metrics.netCashFlow >= 0 ? "watch" : "pressure"}
            detail="Adjusted revenue minus adjusted expenses"
            explanation="Shows whether operations are generating cash before financing decisions. Executives use it to separate growth pressure from liquidity pressure."
          />
          <MetricCard
            icon={<Banknote size={20} />}
            label="Runway"
            value={runwayLabel}
            status={
              metrics.runwayMonths === null || metrics.runwayMonths >= 9
                ? "stable"
                : metrics.runwayMonths >= 6
                  ? "watch"
                  : "pressure"
            }
            detail="Based on current cash and monthly burn"
            explanation="Measures how much decision time the company has before cash reserves constrain strategy."
          />
          <MetricCard
            icon={<Gauge size={20} />}
            label="Expense Ratio"
            value={formatPercent(metrics.expenseRatio)}
            status={metrics.expenseRatio <= 0.65 ? "stable" : metrics.expenseRatio <= 0.7 ? "watch" : "pressure"}
            detail="Adjusted expenses divided by adjusted revenue"
            explanation="Indicates how much revenue is consumed by the operating model before reinvestment or reserves."
          />
          <MetricCard
            icon={<ReceiptText size={20} />}
            label="Cash Delayed"
            value={formatCurrency(metrics.cashDelayed)}
            status={metrics.adjustedCollectionDays <= 40 ? "stable" : metrics.adjustedCollectionDays <= 50 ? "watch" : "pressure"}
            detail={`${formatCurrency(metrics.cashDelayed)} is unavailable for payroll, vendor commitments, or growth reinvestment while invoices age.`}
            explanation="Quantifies cash trapped in receivables. It highlights operational liquidity that exists on paper but is not usable yet."
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel
            title="Scenario Engine"
            eyebrow="Active assumptions"
            className="border-[var(--gold)]/20 bg-white shadow-[0_12px_34px_rgba(7,20,38,0.06)]"
          >
            <div
              className={clsx(
                "mb-3 rounded-xl border border-[var(--line)] bg-white p-3 transition-opacity duration-200",
                isPending && "opacity-70",
              )}
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
                    Executive Input Panel
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Operating assumptions powering every score, flag, forecast, and action.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1">
                    {(["Demo Mode", "Live Input Mode"] as DataMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={clsx(
                          "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                          dataMode === mode
                            ? "bg-[var(--navy)] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]",
                        )}
                        onClick={() => updateDataMode(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1">
                    {(["Conservative", "Balanced", "Aggressive"] as ExecutiveMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={clsx(
                          "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                          executiveMode === mode
                            ? "bg-[var(--navy)] text-white"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]",
                        )}
                        onClick={() => startTransition(() => setExecutiveMode(mode))}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {dataMode === "Live Input Mode" ? (
                <div className="mt-3 rounded-lg border border-[var(--gold)]/35 bg-[var(--gold)]/10 px-3 py-2 text-xs font-semibold text-[var(--gold)]">
                  Live Input Mode uses manually entered operating assumptions.
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <AssumptionInput
                  label="Monthly revenue"
                  value={assumptions.monthlyRevenue}
                  prefix="$"
                  step={1000}
                  disabled={dataMode === "Demo Mode"}
                  onChange={(value) => updateAssumption("monthlyRevenue", value)}
                />
                <AssumptionInput
                  label="Fixed expenses"
                  value={assumptions.fixedExpenses}
                  prefix="$"
                  step={1000}
                  disabled={dataMode === "Demo Mode"}
                  onChange={(value) => updateAssumption("fixedExpenses", value)}
                />
                <AssumptionInput
                  label="Variable expenses"
                  value={assumptions.variableExpenses}
                  prefix="$"
                  step={1000}
                  disabled={dataMode === "Demo Mode"}
                  onChange={(value) => updateAssumption("variableExpenses", value)}
                />
                <AssumptionInput
                  label="Current cash"
                  value={assumptions.currentCash}
                  prefix="$"
                  step={1000}
                  disabled={dataMode === "Demo Mode"}
                  onChange={(value) => updateAssumption("currentCash", value)}
                />
                <AssumptionInput
                  label="AR days"
                  value={assumptions.arDays}
                  suffix="d"
                  step={1}
                  disabled={dataMode === "Demo Mode"}
                  onChange={(value) => updateAssumption("arDays", value)}
                />
                <AssumptionInput
                  label="Largest client"
                  value={assumptions.largestClientPercent}
                  suffix="%"
                  step={1}
                  disabled={dataMode === "Demo Mode"}
                  onChange={(value) => updateAssumption("largestClientPercent", value)}
                />
                <AssumptionInput
                  label="Overdue receivables"
                  value={assumptions.percentOverdue}
                  suffix="%"
                  step={1}
                  disabled={dataMode === "Demo Mode"}
                  onChange={(value) => updateAssumption("percentOverdue", value)}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(businessScenarioPresets).map(([name, preset]) => (
                  <button
                    key={name}
                    type="button"
                    className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-center text-xs font-semibold text-[var(--slate)] transition-colors duration-200 hover:border-[var(--gold)]/45 hover:bg-white"
                    onClick={() => applyPreset(preset)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
              <div className="grid gap-3.5">
              <ScenarioSlider
                label="Revenue Change"
                value={inputs.revenueChange}
                min={-30}
                max={30}
                suffix="%"
                onChange={(revenueChange) => updateInputs((current) => ({ ...current, revenueChange }))}
              />
              <ScenarioSlider
                label="Expense Change"
                value={inputs.expenseChange}
                min={-30}
                max={30}
                suffix="%"
                onChange={(expenseChange) => updateInputs((current) => ({ ...current, expenseChange }))}
              />
              <ScenarioSlider
                label="Collection Delay Change"
                value={inputs.collectionDelayChange}
                min={-20}
                max={30}
                suffix=" days"
                onChange={(collectionDelayChange) =>
                  updateInputs((current) => ({ ...current, collectionDelayChange }))
                }
              />
              </div>
            </div>

            <div className="mt-3 grid gap-2.5 rounded-xl border border-[var(--line)] bg-white p-3 sm:grid-cols-3">
              <SmallReadout label="Adjusted Revenue" value={formatCurrency(metrics.adjustedRevenue)} />
              <SmallReadout label="Adjusted Expenses" value={formatCurrency(metrics.adjustedExpenses)} />
              <SmallReadout label="Monthly Burn" value={formatCurrency(metrics.monthlyBurn)} />
            </div>

            <div className="mt-2.5 grid gap-2.5 rounded-xl border border-[var(--gold)]/20 bg-[var(--panel)] p-3 sm:grid-cols-3">
              <DeltaReadout label="Revenue Delta" value={formatCurrencyDelta(metrics.deltas.revenue)} />
              <DeltaReadout label="Cash Flow Delta" value={formatCurrencyDelta(metrics.deltas.netCashFlow)} />
              <DeltaReadout label="Cash Delayed Delta" value={formatCurrencyDelta(metrics.deltas.cashDelayed)} />
              <DeltaReadout
                label="Collection Days Delta"
                value={formatSignedNumber(metrics.deltas.collectionDays, " days")}
              />
              <DeltaReadout label="Health Score Delta" value={formatSignedNumber(metrics.deltas.healthScore, " pts")} />
              <DeltaReadout label="Expense Delta" value={formatCurrencyDelta(metrics.deltas.expenses)} inverse />
            </div>

            <div className="mt-2.5 rounded-xl border border-[var(--line)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
                What changed?
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--slate)]">{scenarioChangeSummary}</p>
            </div>
          </Panel>

          <Panel
            title="Cash / Runway Forecast"
            eyebrow="Six-month projection"
            subtitle="Projected liquidity position against minimum safe cash threshold."
            className="border-[var(--gold)]/35 shadow-[0_20px_55px_rgba(7,20,38,0.1)]"
            titleClassName="text-2xl"
          >
            <div className="h-[23rem] rounded-xl border border-[var(--line)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-2 py-3">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 16, left: 4, bottom: 6 }}>
                  <defs>
                    <linearGradient id="cashFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#b8913b" stopOpacity={0.32} />
                      <stop offset="70%" stopColor="#b8913b" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#b8913b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(49,65,85,0.14)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#657386", fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => compactCurrency.format(Number(value))}
                    tick={{ fill: "#657386", fontSize: 12, fontWeight: 600 }}
                    width={76}
                  />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area
                    type="monotone"
                    dataKey="cash"
                    name="Projected cash"
                    stroke="#0b1628"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#0b1628", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#b8913b", stroke: "#0b1628", strokeWidth: 2 }}
                    fill="url(#cashFill)"
                    isAnimationActive
                    animationDuration={450}
                    animationEasing="ease-out"
                  />
                  <Line
                    type="monotone"
                    dataKey="minimumSafe"
                    name="Minimum safe cash"
                    stroke="rgba(180,35,24,0.62)"
                    strokeWidth={2}
                    strokeDasharray="6 6"
                    dot={false}
                    isAnimationActive
                    animationDuration={450}
                    animationEasing="ease-out"
                  />
                </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder />
              )}
            </div>
            <ExecutiveInsight>
              {getCashForecastInsight(metrics)}
            </ExecutiveInsight>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel title="Forecast Scenarios" eyebrow="Base, upside, stress" compact>
            <div className="h-[16.5rem]">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={scenarioData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(49,65,85,0.14)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="cash"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => compactCurrency.format(Number(value))}
                    width={76}
                  />
                  <YAxis yAxisId="score" orientation="right" domain={[0, 100]} hide />
                  <Tooltip formatter={(value, name) => [formatChartValue(Number(value), String(name)), name]} />
                  <Bar yAxisId="cash" dataKey="revenue" name="Revenue" fill="#0b1628" radius={[5, 5, 0, 0]} barSize={36} isAnimationActive animationDuration={450} />
                  <Bar yAxisId="cash" dataKey="expenses" name="Expenses" fill="#c9972f" radius={[5, 5, 0, 0]} barSize={36} isAnimationActive animationDuration={450} />
                  <Line yAxisId="cash" dataKey="cashFlow" name="Net cash flow" stroke="#13795b" strokeWidth={3} isAnimationActive animationDuration={450} />
                  <Line yAxisId="score" dataKey="score" name="Health score" stroke="rgba(101,115,134,0.42)" strokeDasharray="4 5" isAnimationActive animationDuration={450} />
                </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder />
              )}
            </div>
            <ExecutiveInsight>
              Scenario movement shows how quickly revenue, expense, and collection pressure change the operating profile.
            </ExecutiveInsight>
          </Panel>

          <Panel title="Risk Flags" eyebrow={`${metrics.riskFlags.length} active`} compact>
            <div className="grid gap-2">
              {riskFlagLabels.map((flag) => {
                const active = metrics.riskFlags.includes(flag);
                return (
                  <div
                    key={flag}
                    className={clsx(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors duration-200",
                      active
                        ? "border-red-100 bg-red-50/55 text-[var(--danger)]"
                        : "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)]",
                    )}
                  >
                    {active ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
                    <span className="text-sm font-semibold">{flag}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </section>

        <section className="grid items-stretch gap-4 xl:grid-cols-[0.78fr_1.22fr]">
          <Panel title="Accounts Receivable / Cash Delay" eyebrow="Drill-down module">
            <div className="grid items-stretch gap-3 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="grid gap-2.5">
                <SmallReadout
                  label="Average Days to Collect"
                  value={`${assumptions.arDays} days`}
                />
                <SmallReadout
                  label="Percent Overdue"
                  value={`${assumptions.percentOverdue}%`}
                />
                <SmallReadout
                  label="Largest Client Percent"
                  value={`${assumptions.largestClientPercent}%`}
                />
                <SmallReadout label="Scenario Cash Delayed" value={formatCurrency(metrics.cashDelayed)} />
                <SmallReadout
                  label="Operational Impact"
                  value={`${formatCurrency(metrics.cashDelayed / 4)} tied up weekly`}
                />
              </div>
              <div className="h-full min-h-[14rem] rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 px-2 py-3">
                {chartsReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={arData} margin={{ top: 6, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(49,65,85,0.14)" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => compactCurrency.format(Number(value))}
                      width={76}
                    />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="cash" name="Cash delayed" radius={[4, 4, 0, 0]}>
                      {arData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === "Scenario delay" ? "#b8913b" : "#0b1628"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartPlaceholder />
                )}
              </div>
            </div>
            <ExecutiveInsight>
              Receivable timing remains a direct liquidity lever because delayed cash limits near-term operating flexibility.
            </ExecutiveInsight>
          </Panel>

          <Panel
            title="Executive Recommendations"
            eyebrow="Recommended actions"
            subtitle="Recommended operating actions based on current pressure points."
            className="border-[var(--gold)]/45 bg-[linear-gradient(180deg,#ffffff_0%,#f7f9fb_100%)] shadow-[0_20px_56px_rgba(7,20,38,0.12)]"
            titleClassName="text-2xl"
          >
            <div className="grid gap-2.5">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200/60 bg-white/60 p-2 sm:grid-cols-2 xl:grid-cols-4">
                <StatusPill label="System Status" status={executiveStatus} />
                {benchmarkRows.map((row) => (
                  <BenchmarkPill key={row.label} {...row} />
                ))}
              </div>
              <ImpactPreview impactModel={impactModel} />
              {metrics.recommendations.map((recommendation, index) => (
                <div key={recommendation.title} className="flex gap-3 rounded-xl border border-[var(--line)] bg-white p-3.5 transition-colors duration-200 hover:border-[var(--gold)]/35">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--navy)] text-xs font-semibold text-white">
                    P{recommendation.priority}
                  </div>
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {index + 1}. {recommendation.title}
                    </p>
                    <p className="text-sm leading-5 text-[var(--slate)]">
                      <span className="font-semibold">Target:</span> {recommendation.target}
                    </p>
                    <p className="text-xs leading-5 text-[var(--muted)]">
                      <span className="font-semibold text-[var(--slate)]">Action:</span>{" "}
                      {recommendation.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Executive Briefing"
            eyebrow="CFO interpretation"
            className="xl:col-span-2"
            titleClassName="text-2xl"
          >
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={handleExportSummary}
                className="rounded-md border border-[var(--gold)]/45 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--gold)] hover:shadow-md"
              >
                Export Executive Summary
              </button>
            </div>
            <div className="grid gap-3 rounded-xl border border-[var(--line)] bg-white p-4 text-sm leading-6 text-[var(--slate)] shadow-[0_10px_30px_rgba(7,20,38,0.05)]">
              {executiveBriefing.map((sentence) => (
                <p key={sentence}>{sentence}</p>
              ))}
            </div>
          </Panel>

          <Panel
            title="Scenario Comparison Engine"
            eyebrow="Mode comparison"
            className="xl:col-span-2"
            titleClassName="text-2xl"
          >
            <ScenarioComparisonEngine comparison={scenarioComparison} />
          </Panel>

          <Panel
            title="Benchmark Intelligence Engine"
            eyebrow="Healthy range comparison"
            className="xl:col-span-2"
            titleClassName="text-2xl"
          >
            <BenchmarkIntelligenceEngine intelligence={benchmarkIntelligence} />
          </Panel>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel title="Financial Mix" eyebrow="Operating profile" compact>
            <div className="h-52">
              {chartsReady ? (
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseBreakdown} dataKey="value" innerRadius={58} outerRadius={92} paddingAngle={3}>
                    {expenseBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                </PieChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder />
              )}
            </div>
            <p className="mt-2 rounded-md border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
              Fixed expenses currently represent approximately {formatPercent(fixedExpenseShare)} of
              operating cost structure.
            </p>
          </Panel>

          <Panel title="Source Operating Data" eyebrow="Fixed sample data" compact>
            <div className="grid gap-3 md:grid-cols-3">
              <SourceBlock title="Revenue" icon={<TrendingUp size={18} />} compact>
                {revenueHistory.map((row) => (
                  <DataRow key={row.month} label={row.month} value={formatCurrency(row.amount)} />
                ))}
              </SourceBlock>
              <SourceBlock title="Expenses" icon={<BriefcaseBusiness size={18} />} compact>
                <DataRow label="Fixed Expenses" value={formatCurrency(assumptions.fixedExpenses)} />
                <DataRow label="Variable Expenses" value={formatCurrency(assumptions.variableExpenses)} />
                <DataRow label="Total" value={formatCurrency(metrics.totalExpenses)} />
              </SourceBlock>
              <SourceBlock title="Cash" icon={<LineChartIcon size={18} />} compact>
                <DataRow label="Current Cash" value={formatCurrency(assumptions.currentCash)} />
                <DataRow label="Minimum Safe Cash" value={formatCurrency(assumptions.minimumSafeCash)} />
                <DataRow label="Average Revenue" value={formatCurrency(metrics.averageRevenue)} />
              </SourceBlock>
            </div>
          </Panel>
        </section>
      </div>

      <footer className="border-t border-slate-300/70 bg-[#e8edf2]">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl">
            <div className="inline-flex rounded-md border border-[var(--gold)]/35 bg-white px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
              Proprietary System
            </div>
            <div className="mt-3 grid gap-2 text-[0.7rem] leading-5 text-[var(--muted)] sm:text-[0.72rem]">
              <p>
                Enterprise Decision Engine&trade; is a proprietary financial analysis and scenario
                modeling system developed by KOSYME Financial Services LLC.
              </p>
              <p>
                This tool is provided for informational and educational demonstration purposes only
                and does not constitute investment advice, legal advice, tax advice, accounting
                assurance services, or licensed financial advisory services.
              </p>
              <p>
                All forecasts, projections, risk indicators, scenario outputs, and executive
                recommendations are illustrative in nature and should not be relied upon as the sole
                basis for financial decision-making.
              </p>
              <p className="pt-1 font-semibold text-[var(--slate)]">
                &copy; 2026 KOSYME Financial Services LLC. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[5.5rem] min-w-32 flex-col justify-between rounded-lg border border-white/10 bg-white/[0.07] p-3.5 text-white shadow-sm transition-colors duration-200 hover:bg-white/[0.1]">
      <p className="text-xs uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: ExecutiveStatus | "managed";
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold uppercase tracking-[0.12em]",
        tone === "stable" && "border-emerald-200 bg-emerald-50 text-[var(--success)]",
        tone === "watch" && "border-[var(--gold)]/45 bg-[var(--gold)]/10 text-[var(--gold)]",
        tone === "managed" && "border-emerald-200 bg-emerald-50 text-[var(--success)]",
        tone === "pressure" && "border-red-200 bg-red-50 text-[var(--danger)]",
        tone === "critical" && "border-red-300 bg-red-100 text-[var(--danger)]",
      )}
    >
      {children}
    </span>
  );
}

function HealthScore({
  score,
  rating,
  drivers,
}: {
  score: number;
  rating: string;
  drivers: Array<{
    label: string;
    penalty: number;
    active: boolean;
    detail: string;
  }>;
}) {
  return (
    <div className="rounded-xl border border-white/12 bg-white p-5 text-[var(--foreground)] shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Financial Health Score
          </p>
          <p className="mt-3 text-5xl font-semibold">{score}</p>
        </div>
        <StatusBadge tone="watch">{rating}</StatusBadge>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-3 flex justify-between text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        <span>At Risk</span>
        <span>Strong</span>
      </div>
      <div className="mt-5 grid gap-2.5">
        {drivers.map((driver) => (
          <div
            key={driver.label}
            className={clsx(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-xs",
              driver.active
                ? "border-red-100 bg-red-50/55 text-[var(--danger)]"
                : "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)]",
            )}
          >
            <span className="font-semibold">{driver.label}</span>
            <span className="text-right">
              {driver.active ? `-${driver.penalty} pts` : "0 pts"} &middot; {driver.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  status,
  explanation,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  status: ExecutiveStatus;
  explanation: string;
}) {
  return (
    <article
      className="group relative flex min-h-[12.5rem] flex-col rounded-xl border border-[var(--line)] bg-white p-[1.125rem] shadow-sm transition-all duration-200 hover:border-[var(--gold)]/35 hover:shadow-md"
      title={explanation}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--navy)] text-white">
          {icon}
        </div>
        <div>
          <StatusBadge tone={status}>
          {status === "pressure" || status === "critical" ? (
            <ArrowDownRight size={16} />
          ) : (
            <ArrowUpRight size={16} />
          )}
          <span>{formatStatus(status)}</span>
          </StatusBadge>
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{detail}</p>
      <div className="pointer-events-none absolute inset-x-4 bottom-4 translate-y-1 rounded-lg border border-[var(--line)] bg-white/95 p-3 text-xs leading-5 text-[var(--slate)] opacity-0 shadow-lg transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
        {explanation}
      </div>
    </article>
  );
}

function ExecutiveInsight({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
      {children}
    </p>
  );
}

function StatusPill({ label, status }: { label: string; status: ExecutiveStatus }) {
  return (
    <div className="flex min-h-[150px] flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-slate-950">{formatStatus(status)}</p>
      <p className="mt-1 text-xs text-slate-500">Current operating posture</p>
      <div className="mt-auto pt-3">
        <StatusOutlineBadge status={status} />
      </div>
    </div>
  );
}

function BenchmarkPill({
  label,
  value,
  range,
  status,
}: {
  label: string;
  value: string;
  range: string;
  status: ExecutiveStatus;
}) {
  return (
    <div className="flex min-h-[150px] flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">Healthy: {range}</p>
      <div className="mt-auto pt-3">
        <StatusOutlineBadge status={status} />
      </div>
    </div>
  );
}

function StatusOutlineBadge({ status }: { status: ExecutiveStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-md border px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]",
        status === "stable" && "border-emerald-300 text-[var(--success)]",
        status === "watch" && "border-[var(--gold)]/55 text-[var(--gold)]",
        (status === "pressure" || status === "critical") && "border-red-300 text-[var(--danger)]",
      )}
    >
      {formatStatus(status)}
    </span>
  );
}

function ImpactPreview({
  impactModel,
}: {
  impactModel: ReturnType<typeof getImpactModel>;
}) {
  const fastest = impactModel.fastestOpportunity;

  return (
    <div className="grid gap-3 rounded-xl border border-[var(--gold)]/25 bg-white p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
          Impact Preview Engine
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
          If this issue is corrected...
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--slate)]">
          {impactModel.executiveSummary}
        </p>
      </div>

      <div className="grid items-stretch gap-3 lg:grid-cols-3">
        {impactModel.opportunities.map((opportunity) => (
          <div
            key={opportunity.title}
            className={clsx(
              "flex h-full min-h-[17.25rem] min-w-0 flex-col overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(7,20,38,0.12)]",
              opportunity.title === fastest.title
                ? "border-[var(--gold)]/80 bg-[linear-gradient(180deg,#fff6e3_0%,#fffdf8_58%,#ffffff_100%)] shadow-[0_16px_38px_rgba(184,145,59,0.22)] ring-1 ring-[var(--gold)]/25 hover:shadow-[0_18px_44px_rgba(184,145,59,0.26)]"
                : "border-slate-200 bg-slate-50/70 shadow-[0_8px_22px_rgba(7,20,38,0.05)]",
            )}
          >
            <div className="grid gap-3">
              <div className="flex min-h-7 items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {opportunity.impactLabel}
                </p>
                {opportunity.title === fastest.title ? (
                  <span className="rounded-md bg-[var(--navy)] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white shadow-sm">
                    Fastest
                  </span>
                ) : null}
              </div>

              <p className="min-h-[3rem] text-[1.05rem] font-bold leading-snug text-[var(--foreground)] sm:text-lg">
                {opportunity.title}
              </p>

              <p className="min-h-[3.25rem] text-[0.72rem] leading-5 text-[var(--muted)]/80">
                {opportunity.action}
              </p>
            </div>
            <div className="mt-auto grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 pt-4 text-xs">
              <ImpactMetricRow
                label="Cash unlocked"
                value={formatCurrency(opportunity.cashUnlocked)}
                emphasis
              />
              <ImpactMetricRow label="Runway change" value={opportunity.runwayImprovement} />
              <ImpactMetricRow
                label="Health score"
                value={formatSignedNumber(opportunity.healthScoreIncrease, " pts")}
                emphasis
              />
              <ImpactMetricRow label="Flags removed" value={`${opportunity.riskFlagsRemoved}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">
            Before / After
          </p>
          <div className="mt-2 grid gap-1.5 text-xs">
            <DataRow label="Current health" value={`${impactModel.beforeAfter.beforeHealth}`} />
            <DataRow label="Projected health" value={`${impactModel.beforeAfter.afterHealth}`} />
            <DataRow label="Current delayed cash" value={formatCurrency(impactModel.beforeAfter.beforeCashDelayed)} />
            <DataRow label="Projected delayed cash" value={formatCurrency(impactModel.beforeAfter.afterCashDelayed)} />
            <DataRow label="Forecast cash impact" value={formatCurrencyDelta(impactModel.beforeAfter.forecastCashImpact)} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">
            Operational Drag Ranking
          </p>
          <div className="mt-2 grid gap-1.5">
            {impactModel.dragRanking.map((item, index) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs"
              >
                <span className="font-semibold text-[var(--foreground)]">
                  {index + 1}. {item.label}
                </span>
                <span className="text-[var(--muted)]">{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImpactMetricRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <>
      <span
        className={clsx(
          "inline-flex min-h-7 min-w-0 items-center text-left text-[var(--slate)]",
          !emphasis && "text-[0.65rem] font-medium opacity-85",
          emphasis && "text-xs font-bold",
        )}
      >
        {label}
      </span>
      <span
        className={clsx(
          "inline-flex min-h-7 items-center justify-end justify-self-end whitespace-nowrap text-right tabular-nums",
          emphasis
            ? "text-base font-bold text-[var(--foreground)]"
            : "text-[0.7rem] font-semibold text-[var(--slate)]/75",
        )}
      >
        {value}
      </span>
    </>
  );
}

function ScenarioComparisonEngine({
  comparison,
}: {
  comparison: ReturnType<typeof getScenarioComparison>;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid items-stretch gap-3 lg:grid-cols-3">
        {comparison.rows.map((row) => (
          <article
            key={row.mode}
            className={clsx(
              "flex h-full min-w-0 flex-col rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
              row.mode === comparison.best.mode &&
                "border-emerald-300 bg-emerald-50/35 ring-1 ring-emerald-200",
              row.mode === comparison.worst.mode &&
                "border-red-200 bg-red-50/30 ring-1 ring-red-100",
              row.mode !== comparison.best.mode &&
                row.mode !== comparison.worst.mode &&
                "border-[var(--line)] bg-white",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold)]">
                  {row.mode}
                </p>
                <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {row.healthScore}
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Health score
                </p>
              </div>
              {row.mode === comparison.best.mode ? (
                <span className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--success)]">
                  Best
                </span>
              ) : null}
              {row.mode === comparison.worst.mode ? (
                <span className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--danger)]">
                  Worst
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 text-xs">
              <ComparisonMetric label="Revenue" value={formatCurrency(row.revenue)} strong />
              <ComparisonMetric label="Expense ratio" value={formatPercent(row.expenseRatio)} />
              <ComparisonMetric label="Net cash flow" value={formatCurrency(row.netCashFlow)} strong />
              <ComparisonMetric label="Cash delayed" value={formatCurrency(row.cashDelayed)} />
              <ComparisonMetric label="Risk flags" value={`${row.riskFlagCount}`} />
              <ComparisonMetric label="Runway" value={row.runway} />
            </div>
          </article>
        ))}
      </div>

      <p className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
        {comparison.interpretation}
      </p>
    </div>
  );
}

function BenchmarkIntelligenceEngine({
  intelligence,
}: {
  intelligence: ReturnType<typeof getBenchmarkIntelligence>;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {intelligence.rows.map((row) => (
          <article
            key={row.label}
            className={clsx(
              "grid min-w-0 gap-3 rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
              row.status === "stable" && "border-[var(--line)]",
              row.status === "watch" && "border-[var(--gold)]/45 bg-[var(--gold)]/5",
              row.status === "pressure" && "border-red-200 bg-red-50/35",
              row.status === "critical" && "border-red-300 bg-red-50/60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  {row.label}
                </p>
                <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
                  {row.current}
                </p>
              </div>
              <StatusOutlineBadge status={row.status} />
            </div>

            <div className="grid gap-2 text-xs">
              <ComparisonMetric label="Healthy benchmark" value={row.benchmark} />
              <ComparisonMetric label="Variance / gap" value={row.variance} strong={row.status !== "stable"} />
            </div>
          </article>
        ))}
      </div>

      <p className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
        {intelligence.summary}
      </p>
    </div>
  );
}

function ComparisonMetric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="grid min-h-7 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[var(--line)] bg-white/80 px-3 py-1.5">
      <span className="min-w-0 text-[var(--muted)]">{label}</span>
      <span
        className={clsx(
          "justify-self-end whitespace-nowrap text-right tabular-nums",
          strong ? "font-bold text-[var(--foreground)]" : "font-semibold text-[var(--slate)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
  className,
  compact = false,
  subtitle,
  titleClassName,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
  subtitle?: string;
  titleClassName?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-[var(--line)] bg-white shadow-sm transition-shadow duration-200 hover:shadow-md",
        compact ? "p-4" : "p-[1.125rem] sm:p-5",
        className,
      )}
    >
      <div className={compact ? "mb-3" : "mb-4"}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
          {eyebrow}
        </p>
        <h2
          className={clsx(
            "mt-2.5 text-xl font-semibold tracking-normal text-[var(--foreground)]",
            titleClassName,
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ScenarioSlider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-3">
      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--slate)]">
        <span>{label}</span>
        <span className="rounded-md bg-[var(--panel)] px-2 py-1 text-[var(--foreground)]">
          {value > 0 ? "+" : ""}
          {value}
          {suffix}
        </span>
      </span>
      <input
        className="w-full appearance-none"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="flex justify-between text-xs text-[var(--muted)]">
        <span>
          {min}
          {suffix}
        </span>
        <span>
          +{max}
          {suffix}
        </span>
      </span>
    </label>
  );
}

function AssumptionInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  step: number;
  disabled?: boolean;
}) {
  return (
    <label
      className={clsx(
        "flex min-w-0 flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition-colors duration-200",
        disabled && "bg-slate-100/70",
      )}
    >
      <span className="break-words text-xs font-semibold uppercase leading-snug tracking-[0.25em] text-[var(--muted)]">
        {label}
      </span>
      <span className="mt-2 flex items-center gap-1 text-base font-bold text-[var(--foreground)]">
        {prefix ? <span className="text-[var(--muted)]">{prefix}</span> : null}
        <input
          className="min-w-0 flex-1 bg-transparent font-bold outline-none"
          type="number"
          min={0}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          title={disabled ? "Switch to Live Input Mode to edit this assumption." : undefined}
        />
        {suffix ? <span className="text-[var(--muted)]">{suffix}</span> : null}
      </span>
    </label>
  );
}

function SmallReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function DeltaReadout({
  label,
  value,
  inverse = false,
}: {
  label: string;
  value: string;
  inverse?: boolean;
}) {
  const numericValue = Number(value.replace(/[^0-9.-]/g, ""));
  const favorable = inverse ? numericValue <= 0 : numericValue >= 0;

  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className={clsx(
          "mt-2 text-lg font-semibold",
          favorable ? "text-[var(--success)]" : "text-[var(--danger)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ChartPlaceholder() {
  return <div className="h-full w-full rounded-md bg-[var(--panel)]" />;
}

function SourceBlock({
  title,
  icon,
  children,
  compact = false,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={clsx("rounded-lg border border-[var(--line)] bg-[var(--panel)]", compact ? "p-3" : "p-4")}>
      <div className={clsx("flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]", compact ? "mb-2" : "mb-3")}>
        {icon}
        <span>{title}</span>
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-semibold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function formatChartValue(value: number, name: string) {
  if (name === "Health score") return numberFormatter.format(value);
  return formatCurrency(value);
}

function formatCurrencyDelta(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

function formatSignedNumber(value: number, suffix: string) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${numberFormatter.format(value)}${suffix}`;
}

function formatStatus(status: ExecutiveStatus) {
  if (status === "stable") return "Stable";
  if (status === "watch") return "Watch";
  if (status === "critical") return "Critical";
  return "Pressure";
}

function getExecutiveStatus(metrics: ReturnType<typeof calculateDecisionMetrics>): ExecutiveStatus {
  if (metrics.healthScore < 45 || metrics.netCashFlow < -10000) return "critical";
  if (metrics.netCashFlow < 0 || metrics.runwayMonths !== null && metrics.runwayMonths < 6) {
    return "pressure";
  }
  if (metrics.riskFlags.length > 0 || metrics.expenseRatio > 0.65) return "watch";
  return "stable";
}

function getBenchmarkRows(metrics: ReturnType<typeof calculateDecisionMetrics>) {
  return [
    {
      label: "Expense Ratio",
      value: formatPercent(metrics.expenseRatio),
      range: "≤ 70%",
      status: metrics.expenseRatio <= 0.65 ? "stable" : metrics.expenseRatio <= 0.7 ? "watch" : "pressure",
    },
    {
      label: "Collection Cycle",
      value: `${metrics.adjustedCollectionDays} days`,
      range: "≤ 40 days",
      status:
        metrics.adjustedCollectionDays <= 40
          ? "stable"
          : metrics.adjustedCollectionDays <= 50
            ? "watch"
            : "pressure",
    },
    {
      label: "Runway",
      value: metrics.runwayMonths === null ? "Surplus" : `${numberFormatter.format(metrics.runwayMonths)} mo`,
      range: "6+ months",
      status:
        metrics.runwayMonths === null || metrics.runwayMonths >= 9
          ? "stable"
          : metrics.runwayMonths >= 6
            ? "watch"
            : "pressure",
    },
  ] satisfies Array<{
    label: string;
    value: string;
    range: string;
    status: ExecutiveStatus;
  }>;
}

function getScenarioChangeSummary(metrics: ReturnType<typeof calculateDecisionMetrics>) {
  const changed = [
    Math.abs(metrics.deltas.revenue),
    Math.abs(metrics.deltas.expenses),
    Math.abs(metrics.deltas.collectionDays),
  ].some((value) => value > 0);

  if (!changed) {
    return "No scenario adjustments are active; the model is showing the current fixed operating baseline.";
  }

  return `Scenario changes move net cash flow by ${formatCurrencyDelta(
    metrics.deltas.netCashFlow,
  )}, shift delayed cash by ${formatCurrencyDelta(
    metrics.deltas.cashDelayed,
  )}, and change the health score by ${formatSignedNumber(metrics.deltas.healthScore, " pts")}.`;
}

function getCashForecastInsight(metrics: ReturnType<typeof calculateDecisionMetrics>) {
  if (metrics.runwayMonths === null) {
    return "Projected cash remains above the safe threshold because the scenario produces monthly operating surplus.";
  }

  if (metrics.runwayMonths < 6) {
    return "Projected liquidity is vulnerable; runway is below the executive six-month operating threshold.";
  }

  return "Projected liquidity remains usable, but collections and concentration risks still require executive monitoring.";
}

function getCashPressureSummary(
  metrics: ReturnType<typeof calculateDecisionMetrics>,
  runwayLabel: string,
) {
  if (metrics.netCashFlow < 0) {
    return `Cash pressure is active: operations are burning ${formatCurrency(
      Math.abs(metrics.netCashFlow),
    )} per month, runway is ${runwayLabel}, and ${formatCurrency(
      metrics.cashDelayed,
    )} is delayed in receivables.`;
  }

  return `Cash pressure is managed: net cash flow is ${formatCurrency(
    metrics.netCashFlow,
  )}, runway is ${runwayLabel}, and ${formatCurrency(
    metrics.cashDelayed,
  )} remains the primary liquidity timing exposure.`;
}

function getExecutiveBriefing(
  metrics: ReturnType<typeof calculateDecisionMetrics>,
  impactModel: ReturnType<typeof getImpactModel>,
) {
  const activeRiskCount = metrics.riskFlags.length;
  const primaryPressure = getPrimaryPressurePoint(metrics);
  const firstAction = impactModel.fastestOpportunity;
  const runwayText =
    metrics.runwayMonths === null
      ? "the company is operating with surplus cash flow"
      : `runway is ${numberFormatter.format(metrics.runwayMonths)} months`;
  const cashImplication =
    metrics.netCashFlow < 0
      ? `Cash implication: the current scenario burns ${formatCurrency(
          Math.abs(metrics.netCashFlow),
        )} per month, ${runwayText}, and ${formatCurrency(
          metrics.cashDelayed,
        )} remains delayed in collections.`
      : `Cash implication: monthly cash flow is positive at ${formatCurrency(
          metrics.netCashFlow,
        )}, but ${formatCurrency(metrics.cashDelayed)} remains tied up in the collection cycle.`;
  const monitorNext = getNextMonitorFocus(metrics);

  return [
    `Current condition: the system is rated ${metrics.healthRating} with a health score of ${metrics.healthScore} and ${activeRiskCount} active risk flag${activeRiskCount === 1 ? "" : "s"}.`,
    `Primary pressure point: ${primaryPressure}.`,
    cashImplication,
    `Recommended first action: ${firstAction.action} This is the fastest operating improvement currently identified.`,
    `Management should monitor ${monitorNext} next and treat any deterioration as an executive review trigger.`,
  ];
}

function getPdfExecutiveBriefing(
  metrics: ReturnType<typeof calculateDecisionMetrics>,
  assumptions: OperatingAssumptions,
) {
  const activeRiskCount = metrics.riskFlags.length;
  const primaryPressure = getPrimaryPressurePoint(metrics);
  const runwayText =
    metrics.runwayMonths === null
      ? "the company is operating with surplus cash flow"
      : `runway is ${numberFormatter.format(metrics.runwayMonths)} months`;
  const cashImplication =
    metrics.netCashFlow < 0
      ? `Cash implication: the current scenario burns ${formatCurrency(
          Math.abs(metrics.netCashFlow),
        )} per month, ${runwayText}, and ${formatCurrency(
          metrics.cashDelayed,
        )} remains delayed in collections.`
      : `Cash implication: monthly cash flow is positive at ${formatCurrency(
          metrics.netCashFlow,
        )}, but ${formatCurrency(metrics.cashDelayed)} remains tied up in the collection cycle.`;
  const recommendedArTarget = Math.min(assumptions.arDays, 35);
  const recommendedFirstAction = `Recommended first action: Reduce AR days from ${assumptions.arDays} to ${recommendedArTarget}. This is the fastest operating improvement currently identified.`;
  const monitorNext = getNextMonitorFocus(metrics);

  return [
    `Current condition: the system is rated ${metrics.healthRating} with a health score of ${metrics.healthScore} and ${activeRiskCount} active risk flag${activeRiskCount === 1 ? "" : "s"}.`,
    `Primary pressure point: ${primaryPressure}.`,
    cashImplication,
    recommendedFirstAction,
    `Management should monitor ${monitorNext} next and treat any deterioration as an executive review trigger.`,
  ];
}

function getPrimaryPressurePoint(metrics: ReturnType<typeof calculateDecisionMetrics>) {
  if (metrics.riskFlags.includes("Negative Cash Flow")) {
    return "cash flow is negative and needs immediate expense or revenue correction";
  }
  if (metrics.riskFlags.includes("Collections Delay Pressure")) {
    return "collection timing is delaying usable cash and reducing operating flexibility";
  }
  if (metrics.riskFlags.includes("Expense Ratio Over 70%")) {
    return `the expense ratio is elevated at ${formatPercent(metrics.expenseRatio)}`;
  }
  if (metrics.riskFlags.includes("High Client Concentration")) {
    return "largest-client concentration is creating avoidable revenue dependency";
  }
  if (metrics.riskFlags.includes("Runway Under 6 Months")) {
    return "runway is below the executive six-month threshold";
  }
  return "no major pressure point is active, but liquidity discipline should remain visible";
}

function getNextMonitorFocus(metrics: ReturnType<typeof calculateDecisionMetrics>) {
  if (metrics.riskFlags.includes("Collections Delay Pressure")) {
    return "AR days, overdue receivables, and weekly cash collections";
  }
  if (metrics.riskFlags.includes("Expense Ratio Over 70%")) {
    return "expense ratio, vendor commitments, and margin leakage";
  }
  if (metrics.riskFlags.includes("High Client Concentration")) {
    return "largest-client exposure and replacement revenue coverage";
  }
  if (metrics.riskFlags.includes("Negative Cash Flow")) {
    return "monthly net cash flow and cash balance against the safe threshold";
  }
  return "AR aging, expense ratio, and client concentration";
}

function getScenarioComparison(inputs: ScenarioInputs, assumptions: OperatingAssumptions) {
  const modes: ExecutiveMode[] = ["Conservative", "Balanced", "Aggressive"];
  const rows = modes.map((mode) => {
    const modeMetrics = calculateDecisionMetrics(inputs, assumptions, mode);
    return {
      mode,
      revenue: modeMetrics.adjustedRevenue,
      expenseRatio: modeMetrics.expenseRatio,
      netCashFlow: modeMetrics.netCashFlow,
      cashDelayed: modeMetrics.cashDelayed,
      healthScore: modeMetrics.healthScore,
      riskFlagCount: modeMetrics.riskFlags.length,
      runway:
        modeMetrics.runwayMonths === null
          ? "Surplus"
          : `${numberFormatter.format(modeMetrics.runwayMonths)} mo`,
    };
  });

  const scoreScenario = (row: (typeof rows)[number]) =>
    row.healthScore * 10 - row.riskFlagCount * 60 + row.netCashFlow / 1000;
  const ranked = [...rows].sort((a, b) => scoreScenario(b) - scoreScenario(a));
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const interpretation =
    best.mode === worst.mode
      ? "Scenario modes are currently producing the same operating posture; management should focus on the active assumptions rather than risk tolerance."
      : `${best.mode} produces the strongest operating posture under the current assumptions, while ${worst.mode} carries the weakest score after applying risk thresholds.`;

  return { rows, best, worst, interpretation };
}

function getBenchmarkIntelligence(
  metrics: ReturnType<typeof calculateDecisionMetrics>,
  assumptions: OperatingAssumptions,
) {
  const runwayGap =
    metrics.runwayMonths === null
      ? "Surplus"
      : `${formatSignedNumber(metrics.runwayMonths - 6, " mo")} vs threshold`;
  const rows = [
    {
      label: "Expense ratio",
      current: formatPercent(metrics.expenseRatio),
      benchmark: "<= 70%",
      variance: `${formatSignedNumber((metrics.expenseRatio - 0.7) * 100, " pts")}`,
      status:
        metrics.expenseRatio <= 0.7
          ? "stable"
          : metrics.expenseRatio <= 0.85
            ? "watch"
            : "pressure",
    },
    {
      label: "AR days",
      current: `${metrics.adjustedCollectionDays} days`,
      benchmark: "<= 40 days",
      variance: `${formatSignedNumber(metrics.adjustedCollectionDays - 40, " days")}`,
      status:
        metrics.adjustedCollectionDays <= 40
          ? "stable"
          : metrics.adjustedCollectionDays <= 50
            ? "watch"
            : "pressure",
    },
    {
      label: "Overdue receivables",
      current: `${assumptions.percentOverdue}%`,
      benchmark: "<= 25%",
      variance: `${formatSignedNumber(assumptions.percentOverdue - 25, " pts")}`,
      status:
        assumptions.percentOverdue <= 25
          ? "stable"
          : assumptions.percentOverdue <= 32
            ? "watch"
            : "pressure",
    },
    {
      label: "Largest client concentration",
      current: `${assumptions.largestClientPercent}%`,
      benchmark: "<= 30%",
      variance: `${formatSignedNumber(assumptions.largestClientPercent - 30, " pts")}`,
      status:
        assumptions.largestClientPercent <= 30
          ? "stable"
          : assumptions.largestClientPercent <= 38
            ? "watch"
            : "pressure",
    },
    {
      label: "Cash runway",
      current:
        metrics.runwayMonths === null
          ? "Surplus"
          : `${numberFormatter.format(metrics.runwayMonths)} mo`,
      benchmark: ">= 6 months",
      variance: runwayGap,
      status:
        metrics.runwayMonths === null || metrics.runwayMonths >= 6
          ? "stable"
          : metrics.runwayMonths >= 3
            ? "watch"
            : "critical",
    },
    {
      label: "Net cash flow",
      current: formatCurrency(metrics.netCashFlow),
      benchmark: ">= $0",
      variance: formatCurrencyDelta(metrics.netCashFlow),
      status:
        metrics.netCashFlow >= 0
          ? "stable"
          : metrics.netCashFlow >= -10000
            ? "watch"
            : "critical",
    },
  ] satisfies Array<{
    label: string;
    current: string;
    benchmark: string;
    variance: string;
    status: ExecutiveStatus;
  }>;

  const outside = rows.filter((row) => row.status !== "stable");
  const strongestGap = outside[0];
  const summary =
    outside.length === 0
      ? "All benchmarked operating metrics are inside healthy ranges; management should preserve current discipline and monitor for drift."
      : `${outside.length} benchmark${outside.length === 1 ? "" : "s"} sit outside the healthy range, with ${strongestGap.label.toLowerCase()} requiring the clearest management attention.`;

  return { rows, summary };
}

function getImpactModel(
  inputs: ScenarioInputs,
  assumptions: OperatingAssumptions,
  executiveMode: ExecutiveMode,
  metrics: ReturnType<typeof calculateDecisionMetrics>,
) {
  const currentFlags = new Set(metrics.riskFlags);
  const currentSixMonthCash = assumptions.currentCash + metrics.netCashFlow * 6;
  const baseRunway = metrics.runwayMonths;

  const candidates = [
    {
      title: "Collections timing correction",
      impactLabel: "Immediate",
      action: `Reduce AR days from ${assumptions.arDays} → ${Math.min(assumptions.arDays, 35)}.`,
      assumptions: {
        ...assumptions,
        arDays: Math.min(assumptions.arDays, 35),
        percentOverdue: Math.min(assumptions.percentOverdue, 24),
      },
    },
    {
      title: "Expense structure reset",
      impactLabel: "30-Day",
      action: "Reduce fixed and variable expenses by 8%.",
      assumptions: {
        ...assumptions,
        fixedExpenses: Math.round(assumptions.fixedExpenses * 0.92),
        variableExpenses: Math.round(assumptions.variableExpenses * 0.92),
      },
    },
    {
      title: "Client concentration reduction",
      impactLabel: assumptions.largestClientPercent > 40 ? "Structural" : "Strategic",
      action: `Lower largest-client concentration to ${Math.min(assumptions.largestClientPercent, 25)}%.`,
      assumptions: {
        ...assumptions,
        largestClientPercent: Math.min(assumptions.largestClientPercent, 25),
      },
    },
  ] as const;

  const opportunities = candidates.map((candidate) => {
    const projected = calculateDecisionMetrics(inputs, candidate.assumptions, executiveMode);
    const projectedFlags = new Set(projected.riskFlags);
    const riskFlagsRemoved = [...currentFlags].filter((flag) => !projectedFlags.has(flag)).length;
    const projectedSixMonthCash = candidate.assumptions.currentCash + projected.netCashFlow * 6;
    const runwayImprovement =
      baseRunway === null || projected.runwayMonths === null
        ? projected.runwayMonths === null
          ? "Surplus"
          : `${numberFormatter.format(projected.runwayMonths)} mo`
        : `${formatSignedNumber(projected.runwayMonths - baseRunway, " mo")}`;

    const cashUnlocked = Math.max(0, metrics.cashDelayed - projected.cashDelayed);

    return {
      title: candidate.title,
      impactLabel: candidate.impactLabel,
      action: candidate.action,
      cashUnlocked,
      runwayImprovement,
      healthScoreIncrease: projected.healthScore - metrics.healthScore,
      riskFlagsRemoved,
      forecastCashImpact: projectedSixMonthCash - currentSixMonthCash,
      projected,
    };
  });

  const fastestOpportunity = [...opportunities].sort((a, b) => {
    const scoreA = a.cashUnlocked / 1000 + a.healthScoreIncrease * 4 + a.riskFlagsRemoved * 20;
    const scoreB = b.cashUnlocked / 1000 + b.healthScoreIncrease * 4 + b.riskFlagsRemoved * 20;
    return scoreB - scoreA;
  })[0];

  const dragRanking = [
    {
      label: "Collections delay",
      score: Math.max(0, assumptions.arDays - 35) + assumptions.percentOverdue,
      detail: `${assumptions.arDays} days / ${assumptions.percentOverdue}% overdue`,
    },
    {
      label: "Expense pressure",
      score: metrics.expenseRatio * 100,
      detail: formatPercent(metrics.expenseRatio),
    },
    {
      label: "Concentration risk",
      score: assumptions.largestClientPercent,
      detail: `${assumptions.largestClientPercent}% largest client`,
    },
    {
      label: "Revenue weakness",
      score: metrics.netCashFlow < 0 ? Math.abs(metrics.netCashFlow) / 1000 : Math.max(0, 10000 - metrics.netCashFlow) / 1000,
      detail: `${formatCurrency(metrics.netCashFlow)} cash flow`,
    },
  ].sort((a, b) => b.score - a.score);

  return {
    opportunities,
    fastestOpportunity,
    dragRanking,
    beforeAfter: {
      beforeHealth: metrics.healthScore,
      afterHealth: fastestOpportunity.projected.healthScore,
      beforeCashDelayed: metrics.cashDelayed,
      afterCashDelayed: fastestOpportunity.projected.cashDelayed,
      forecastCashImpact: fastestOpportunity.forecastCashImpact,
    },
    executiveSummary: getImpactSummary(fastestOpportunity),
  };
}

function getImpactSummary(opportunity: {
  title: string;
  cashUnlocked: number;
  healthScoreIncrease: number;
  riskFlagsRemoved: number;
}) {
  if (opportunity.title === "Collections timing correction") {
    return `The largest near-term liquidity improvement comes from reducing collection timing, unlocking ${formatCurrency(
      opportunity.cashUnlocked,
    )} of operating cash and improving health score by ${formatSignedNumber(
      opportunity.healthScoreIncrease,
      " pts",
    )}.`;
  }

  if (opportunity.title === "Expense structure reset") {
    return `The highest operating leverage comes from expense reduction, improving score by ${formatSignedNumber(
      opportunity.healthScoreIncrease,
      " pts",
    )} and removing ${opportunity.riskFlagsRemoved} risk flag${opportunity.riskFlagsRemoved === 1 ? "" : "s"}.`;
  }

  return `The biggest strategic risk reduction comes from lowering client concentration, removing ${opportunity.riskFlagsRemoved} risk flag${opportunity.riskFlagsRemoved === 1 ? "" : "s"} and strengthening enterprise resilience.`;
}
