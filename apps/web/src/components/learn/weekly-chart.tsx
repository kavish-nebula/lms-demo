"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/components/kit/chart-card";

/** Minutes learned per day this week. Bars use the --chart-1 token. */
export function WeeklyChart({ data, today }: { data: { day: string; minutes: number }[]; today: string }) {
  const t = useTranslations("home");
  const format = useFormatter();
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const rows = data.map((d) => ({
    ...d,
    label: format.dateTime(new Date(d.day + "T12:00:00Z"), { weekday: "short" }),
    isToday: d.day === today,
  }));

  return (
    <ChartCard title={t("dailyProgress")} description={t("weekTotal", { minutes: total })}>
      <div className="h-48 w-full" role="img" aria-label={t("weekChartLabel", { minutes: total })}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--faint)", fontSize: 12 }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--faint)", fontSize: 12 }} width={48} />
            <Tooltip
              cursor={{ fill: "var(--accent-soft)" }}
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                boxShadow: "var(--shadow-sm)",
                fontSize: 13,
              }}
              formatter={(v) => [t("minutesValue", { count: Number(v) }), ""]}
              separator=""
            />
            <Bar dataKey="minutes" radius={[6, 6, 6, 6]} maxBarSize={28} fill="var(--chart-1)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
