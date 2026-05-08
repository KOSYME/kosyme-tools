import { defaultOperatingAssumptions, type OperatingAssumptions } from "./sampleData";

export type ScenarioInputs = {
  revenueChange: number;
  expenseChange: number;
  collectionDelayChange: number;
};

export type ExecutiveMode = "Conservative" | "Balanced" | "Aggressive";

export type RiskFlag =
  | "Negative Cash Flow"
  | "Runway Under 6 Months"
  | "High Client Concentration"
  | "Expense Ratio Over 70%"
  | "Collections Delay Pressure";

export type DecisionMetrics = {
  latestRevenue: number;
  averageRevenue: number;
  totalExpenses: number;
  adjustedRevenue: number;
  adjustedExpenses: number;
  netCashFlow: number;
  monthlyBurn: number;
  runwayMonths: number | null;
  expenseRatio: number;
  adjustedCollectionDays: number;
  cashDelayed: number;
  healthScore: number;
  healthRating: "Strong" | "Stable" | "Watch" | "At Risk";
  alert: {
    level: "critical" | "watch" | "stable";
    headline: string;
    message: string;
  };
  healthScoreDrivers: Array<{
    label: string;
    penalty: number;
    active: boolean;
    detail: string;
  }>;
  deltas: {
    revenue: number;
    expenses: number;
    netCashFlow: number;
    cashDelayed: number;
    collectionDays: number;
    healthScore: number;
  };
  riskFlags: RiskFlag[];
  recommendations: Array<{
    priority: 1 | 2 | 3 | 4 | 5;
    title: string;
    target: string;
    action: string;
  }>;
};

const recommendationMap: Record<
  RiskFlag,
  (context: { largestClientPercent: number }) => {
    title: string;
    target: string;
    action: string;
  }
> = {
  "Negative Cash Flow": () => ({
    title: "Restore positive monthly cash flow",
    target: "Move net cash flow above $0 within 30 days.",
    action:
      "Cut or defer at least the current monthly deficit before approving new discretionary spend.",
  }),
  "Runway Under 6 Months": () => ({
    title: "Rebuild minimum runway",
    target: "Reach at least 6.0 months of runway and keep cash above $60,000.",
    action:
      "Freeze nonessential commitments until the six-month runway threshold is restored.",
  }),
  "High Client Concentration": ({ largestClientPercent }) => ({
    title: "Lower client concentration",
    target: `Reduce largest-client exposure from ${largestClientPercent}% to 30% or less.`,
    action:
      `Add replacement revenue or rebalance account coverage equal to at least ${Math.max(
        1,
        largestClientPercent - 30,
      )} percentage points of revenue.`,
  }),
  "Expense Ratio Over 70%": () => ({
    title: "Reset operating expense ratio",
    target: "Bring expenses below 70% of adjusted revenue.",
    action:
      "Renegotiate delivery costs and vendor spend until the current ratio clears the 70% threshold.",
  }),
  "Collections Delay Pressure": () => ({
    title: "Shorten cash collection cycle",
    target: "Reduce overdue AR below 25% and collection timing to 40 days or less.",
    action:
      "Move overdue accounts into weekly executive review and require revised payment terms for slow-paying customers.",
  }),
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function calculateDecisionMetrics(
  inputs: ScenarioInputs,
  assumptions: OperatingAssumptions = defaultOperatingAssumptions,
  mode: ExecutiveMode = "Balanced",
): DecisionMetrics {
  const thresholds = getModeThresholds(mode);
  const latestRevenue = assumptions.monthlyRevenue;
  const averageRevenue = assumptions.monthlyRevenue;
  const totalExpenses = assumptions.fixedExpenses + assumptions.variableExpenses;
  const adjustedRevenue = latestRevenue * (1 + inputs.revenueChange / 100);
  const adjustedExpenses = totalExpenses * (1 + inputs.expenseChange / 100);
  const netCashFlow = adjustedRevenue - adjustedExpenses;
  const monthlyBurn = netCashFlow < 0 ? Math.abs(netCashFlow) : 0;
  const runwayMonths = monthlyBurn === 0 ? null : assumptions.currentCash / monthlyBurn;
  const expenseRatio = adjustedRevenue === 0 ? 1 : adjustedExpenses / adjustedRevenue;
  const adjustedCollectionDays = Math.max(
    0,
    assumptions.arDays + inputs.collectionDelayChange,
  );
  const cashDelayed = (adjustedRevenue / 30) * adjustedCollectionDays;
  const baselineRevenue = latestRevenue;
  const baselineExpenses = totalExpenses;
  const baselineCashFlow = baselineRevenue - baselineExpenses;
  const baselineCollectionDays = assumptions.arDays;
  const baselineCashDelayed = (baselineRevenue / 30) * baselineCollectionDays;

  const healthScoreDrivers = [
    {
      label: "Negative cash flow",
      penalty: 25,
      active: netCashFlow < 0,
      detail: `${formatCurrency(netCashFlow)} net monthly cash flow`,
    },
    {
      label: "Runway under 6 months",
      penalty: 20,
      active: runwayMonths !== null && runwayMonths < thresholds.runwayMonths,
      detail: runwayMonths === null ? "Surplus; no burn" : `${runwayMonths.toFixed(1)} months runway`,
    },
    {
      label: `Expense ratio over ${Math.round(thresholds.expenseRatio * 100)}%`,
      penalty: 20,
      active: expenseRatio > thresholds.expenseRatio,
      detail: `${formatPercent(expenseRatio)} expense ratio`,
    },
    {
      label: "Largest client over 30%",
      penalty: 15,
      active: assumptions.largestClientPercent > thresholds.clientConcentration,
      detail: `${assumptions.largestClientPercent}% largest-client exposure`,
    },
    {
      label: "Overdue AR over 25%",
      penalty: 10,
      active: assumptions.percentOverdue > thresholds.percentOverdue,
      detail: `${assumptions.percentOverdue}% overdue receivables`,
    },
    {
      label: "Collection delay change over 10 days",
      penalty: 10,
      active: inputs.collectionDelayChange > 10,
      detail: `${inputs.collectionDelayChange > 0 ? "+" : ""}${inputs.collectionDelayChange} day scenario change`,
    },
  ];

  let healthScore = 100 - healthScoreDrivers.reduce(
    (total, driver) => total + (driver.active ? driver.penalty : 0),
    0,
  );

  healthScore = Math.min(100, Math.max(0, Math.round(healthScore)));

  const riskFlags: RiskFlag[] = [];
  if (netCashFlow < 0) riskFlags.push("Negative Cash Flow");
  if (runwayMonths !== null && runwayMonths < thresholds.runwayMonths) riskFlags.push("Runway Under 6 Months");
  if (assumptions.largestClientPercent > thresholds.clientConcentration) {
    riskFlags.push("High Client Concentration");
  }
  if (expenseRatio > thresholds.expenseRatio) riskFlags.push("Expense Ratio Over 70%");
  if (assumptions.percentOverdue > thresholds.percentOverdue || inputs.collectionDelayChange > 10) {
    riskFlags.push("Collections Delay Pressure");
  }

  const baselineHealthScore = calculateHealthScore({
    netCashFlow: baselineCashFlow,
    runwayMonths: baselineCashFlow < 0 ? assumptions.currentCash / Math.abs(baselineCashFlow) : null,
    expenseRatio: baselineExpenses / baselineRevenue,
    collectionDelayChange: 0,
    assumptions,
    mode,
  });

  return {
    latestRevenue,
    averageRevenue,
    totalExpenses,
    adjustedRevenue,
    adjustedExpenses,
    netCashFlow,
    monthlyBurn,
    runwayMonths,
    expenseRatio,
    adjustedCollectionDays,
    cashDelayed,
    healthScore,
    healthRating: getHealthRating(healthScore),
    alert: getAlert(healthScore, riskFlags, netCashFlow, cashDelayed),
    healthScoreDrivers,
    deltas: {
      revenue: adjustedRevenue - baselineRevenue,
      expenses: adjustedExpenses - baselineExpenses,
      netCashFlow: netCashFlow - baselineCashFlow,
      cashDelayed: cashDelayed - baselineCashDelayed,
      collectionDays: adjustedCollectionDays - baselineCollectionDays,
      healthScore: healthScore - baselineHealthScore,
    },
    riskFlags,
    recommendations: getRecommendations(riskFlags, {
      netCashFlow,
      runwayMonths,
      expenseRatio,
      adjustedCollectionDays,
      largestClientPercent: assumptions.largestClientPercent,
    }),
  };
}

function getHealthRating(score: number): DecisionMetrics["healthRating"] {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Stable";
  if (score >= 45) return "Watch";
  return "At Risk";
}

function calculateHealthScore({
  netCashFlow,
  runwayMonths,
  expenseRatio,
  collectionDelayChange,
  assumptions,
  mode,
}: {
  netCashFlow: number;
  runwayMonths: number | null;
  expenseRatio: number;
  collectionDelayChange: number;
  assumptions: OperatingAssumptions;
  mode: ExecutiveMode;
}) {
  const thresholds = getModeThresholds(mode);
  let score = 100;
  if (netCashFlow < 0) score -= 25;
  if (runwayMonths !== null && runwayMonths < thresholds.runwayMonths) score -= 20;
  if (expenseRatio > thresholds.expenseRatio) score -= 20;
  if (assumptions.largestClientPercent > thresholds.clientConcentration) score -= 15;
  if (assumptions.percentOverdue > thresholds.percentOverdue) score -= 10;
  if (collectionDelayChange > 10) score -= 10;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function getAlert(
  healthScore: number,
  riskFlags: RiskFlag[],
  netCashFlow: number,
  cashDelayed: number,
): DecisionMetrics["alert"] {
  if (healthScore < 45 || riskFlags.includes("Negative Cash Flow")) {
    return {
      level: "critical",
      headline: "Executive Alert: Cash pressure requires immediate action",
      message: `${formatCurrency(Math.abs(netCashFlow))} monthly cash pressure and ${formatCurrency(
        cashDelayed,
      )} delayed in collections put operating flexibility at risk.`,
    };
  }

  if (riskFlags.length > 0) {
    return {
      level: "watch",
      headline: "Executive Alert: Watch list conditions are active",
      message: `${riskFlags.length} risk flag${
        riskFlags.length === 1 ? "" : "s"
      } active. Prioritize collections, concentration, and expense discipline before growth spend.`,
    };
  }

  return {
    level: "stable",
    headline: "Executive Alert: Operating profile is stable",
    message:
      "No active risk flags. Maintain monthly monitoring of AR aging, customer concentration, and expense ratio.",
  };
}

function getRecommendations(
  riskFlags: RiskFlag[],
  metrics: {
    netCashFlow: number;
    runwayMonths: number | null;
    expenseRatio: number;
    adjustedCollectionDays: number;
    largestClientPercent: number;
  },
): DecisionMetrics["recommendations"] {
  if (riskFlags.length === 0) {
    return [
      {
        priority: 1,
        title: "Maintain operating discipline",
        target: "Keep health score at 80+ and expense ratio below 70%.",
        action:
          "Review AR aging, largest-client share, and cash runway in the monthly executive packet.",
      },
    ];
  }

  const severityScore: Record<RiskFlag, number> = {
    "Negative Cash Flow": metrics.netCashFlow < 0 ? 120 : 0,
    "Runway Under 6 Months":
      metrics.runwayMonths === null ? 0 : metrics.runwayMonths < 3 ? 110 : 92,
    "Collections Delay Pressure": metrics.adjustedCollectionDays > 55 ? 100 : 86,
    "Expense Ratio Over 70%": metrics.expenseRatio > 0.9 ? 96 : 78,
    "High Client Concentration": 72,
  };

  return [...riskFlags].sort((a, b) => severityScore[b] - severityScore[a]).map((flag, index) => ({
    priority: (index + 1) as 1 | 2 | 3 | 4 | 5,
    ...recommendationMap[flag]({ largestClientPercent: metrics.largestClientPercent }),
  }));
}

function getModeThresholds(mode: ExecutiveMode) {
  if (mode === "Conservative") {
    return {
      runwayMonths: 9,
      expenseRatio: 0.65,
      clientConcentration: 25,
      percentOverdue: 20,
    };
  }

  if (mode === "Aggressive") {
    return {
      runwayMonths: 4,
      expenseRatio: 0.78,
      clientConcentration: 38,
      percentOverdue: 32,
    };
  }

  return {
    runwayMonths: 6,
    expenseRatio: 0.7,
    clientConcentration: 30,
    percentOverdue: 25,
  };
}
