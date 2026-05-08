export const sampleData = {
  revenue: [
    { month: "Month -3", amount: 85000 },
    { month: "Month -2", amount: 92000 },
    { month: "Month -1", amount: 78000 },
  ],
  expenses: {
    fixed: 55000,
    variable: 18000,
  },
  cash: {
    current: 120000,
    minimumSafe: 60000,
  },
  accountsReceivable: {
    averageDaysToCollect: 47,
    percentOverdue: 32,
    largestClientPercent: 38,
  },
};

export type SampleData = typeof sampleData;

export type OperatingAssumptions = {
  monthlyRevenue: number;
  fixedExpenses: number;
  variableExpenses: number;
  currentCash: number;
  minimumSafeCash: number;
  arDays: number;
  largestClientPercent: number;
  percentOverdue: number;
};

export const defaultOperatingAssumptions: OperatingAssumptions = {
  monthlyRevenue: sampleData.revenue.at(-1)?.amount ?? 78000,
  fixedExpenses: sampleData.expenses.fixed,
  variableExpenses: sampleData.expenses.variable,
  currentCash: sampleData.cash.current,
  minimumSafeCash: sampleData.cash.minimumSafe,
  arDays: sampleData.accountsReceivable.averageDaysToCollect,
  largestClientPercent: sampleData.accountsReceivable.largestClientPercent,
  percentOverdue: sampleData.accountsReceivable.percentOverdue,
};

export const businessScenarioPresets: Record<string, OperatingAssumptions> = {
  "Stable Growth Company": {
    monthlyRevenue: 140000,
    fixedExpenses: 62000,
    variableExpenses: 26000,
    currentCash: 260000,
    minimumSafeCash: 85000,
    arDays: 34,
    largestClientPercent: 18,
    percentOverdue: 12,
  },
  "Cash Pressure Company": {
    monthlyRevenue: 84000,
    fixedExpenses: 66000,
    variableExpenses: 30000,
    currentCash: 72000,
    minimumSafeCash: 65000,
    arDays: 56,
    largestClientPercent: 27,
    percentOverdue: 31,
  },
  "High Concentration Risk": {
    monthlyRevenue: 118000,
    fixedExpenses: 65000,
    variableExpenses: 24000,
    currentCash: 150000,
    minimumSafeCash: 70000,
    arDays: 44,
    largestClientPercent: 52,
    percentOverdue: 22,
  },
  "Seasonal Business": {
    monthlyRevenue: 98000,
    fixedExpenses: 58000,
    variableExpenses: 21000,
    currentCash: 185000,
    minimumSafeCash: 90000,
    arDays: 48,
    largestClientPercent: 29,
    percentOverdue: 19,
  },
  "Distressed Operations": {
    monthlyRevenue: 69000,
    fixedExpenses: 68000,
    variableExpenses: 32000,
    currentCash: 43000,
    minimumSafeCash: 60000,
    arDays: 68,
    largestClientPercent: 41,
    percentOverdue: 46,
  },
};
