"use client";

import {
  CartesianGrid,
  LabelList,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type ChartPoint = {
  x: number;
  y: number;
  label: string;
  amount: number;
};

export default function TimelineChart({
  chartData,
  chartDays,
  paymentTerms,
}: {
  chartData: ChartPoint[];
  chartDays: number;
  paymentTerms: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
        <CartesianGrid stroke="rgba(148, 163, 184, 0.25)" vertical={false} />
        <XAxis
          dataKey="x"
          domain={[0, chartDays]}
          tickCount={7}
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#516070", fontSize: 12 }}
          tickFormatter={(value) => `Day ${value}`}
        />
        <YAxis
          dataKey="y"
          type="number"
          domain={[-0.5, 1.5]}
          ticks={[0, 1]}
          tickLine={false}
          axisLine={false}
          width={92}
          tick={{ fill: "#516070", fontSize: 12 }}
          tickFormatter={(value) => (value === 0 ? "Cash out" : "Cash in")}
        />
        <ReferenceArea
          x1={0}
          x2={Math.max(paymentTerms, 1)}
          y1={-0.5}
          y2={1.5}
          fill="rgba(34, 197, 94, 0.12)"
          strokeOpacity={0}
        />
        <Tooltip
          cursor={{ strokeDasharray: "4 4", stroke: "#0f172a", opacity: 0.12 }}
          contentStyle={{
            borderRadius: "18px",
            border: "1px solid rgba(148, 163, 184, 0.22)",
            boxShadow: "0 18px 50px rgba(15, 23, 42, 0.14)",
          }}
          formatter={(value, _name, item) => {
            const numericValue = typeof value === "number" ? value : Number(value ?? 0);

            if (item.payload.label === "Cash outflow") {
              return [currencyFormatter.format(numericValue), "Monthly cost"];
            }

            return [currencyFormatter.format(numericValue), "Monthly revenue"];
          }}
          labelFormatter={(value) => `Day ${value}`}
        />
        <Scatter data={chartData} fill="#0f172a" line={{ stroke: "#0f172a", strokeWidth: 2 }}>
          <LabelList dataKey="label" position="top" fill="#0f172a" fontSize={12} />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
