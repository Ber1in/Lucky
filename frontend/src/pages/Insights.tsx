import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type NumberStat } from "../api";

const WINDOWS = [
  { value: "all", label: "全部历史" },
  { value: "last100", label: "近 100 期" },
  { value: "last1y", label: "近 1 年" },
];

const pad = (value: number) => String(value).padStart(2, "0");

function StatTable({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: NumberStat[];
  accent: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="card">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.number} className="flex items-center gap-2 text-sm">
            <span className="w-7 shrink-0 text-right font-mono text-slate-600">{pad(row.number)}</span>
            <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
              <div className={accent} style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-slate-700">{row.count}</span>
            <span className="w-14 shrink-0 text-right text-slate-400">{row.pct}%</span>
            <span className="w-16 shrink-0 text-right text-slate-400">
              {row.omission === null ? "从未出现" : `遗漏 ${row.omission}`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Insights() {
  const [window, setWindow] = useState("all");
  const query = useQuery({ queryKey: ["insights", window], queryFn: () => api.insights(window) });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">号码统计</h1>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {WINDOWS.map((item) => (
            <button
              key={item.value}
              onClick={() => setWindow(item.value)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                window === item.value
                  ? "bg-white font-medium text-brand-700 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        统计仅供记录与观察，开奖为独立随机事件，频率和遗漏不构成预测依据。当前样本：
        {query.data?.sample_size ?? 0} 期。
      </p>

      {query.isLoading && <p className="text-sm text-slate-500">加载中…</p>}
      {query.data && (
        <div className="grid gap-5 lg:grid-cols-2">
          <StatTable title="前区 01–35" rows={query.data.front} accent="h-full bg-brand-500" />
          <StatTable title="后区 01–12" rows={query.data.back} accent="h-full bg-sky-500" />
        </div>
      )}
    </div>
  );
}
