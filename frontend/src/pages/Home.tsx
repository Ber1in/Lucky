import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Balls } from "../components/Balls";

export function Home() {
  const { user } = useAuth();
  const latest = useQuery({ queryKey: ["latest"], queryFn: api.latest });
  const recent = useQuery({ queryKey: ["draws", 1, 5], queryFn: () => api.draws(1, 5) });
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary, enabled: !!user });
  const next = useQuery({
    queryKey: ["next-draw"],
    queryFn: api.nextDraw,
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold">最新开奖</h1>
          <Link to="/history" className="text-sm text-brand-600 hover:underline">
            查看全部
          </Link>
        </div>
        {latest.isLoading && <p className="text-sm text-slate-500">加载中…</p>}
        {latest.isError && (
          <p className="text-sm text-red-600">
            暂无开奖数据，请等待 worker 完成首次回填，或手动执行 backfill。
          </p>
        )}
        {latest.data && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-bold text-slate-900">第 {latest.data.draw_no} 期</span>
              <span className="text-sm text-slate-500">{latest.data.draw_date}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {latest.data.rule_version === "seven_tier" ? "七等奖制" : "历史规则"}
              </span>
            </div>
            <Balls front={latest.data.front_numbers} back={latest.data.back_numbers} />
            <div className="flex flex-wrap gap-6 text-sm text-slate-500">
              <span>当前奖池（滚存至下期）：{formatMoney(latest.data.pool_balance)}</span>
              <span>上期销售额（开奖后公布）：{formatMoney(latest.data.sales_amount)}</span>
            </div>
            {next.data && (
              <p className="text-sm text-slate-500">
                下一期：{next.data.draw_no} · {formatDrawDate(next.data.draw_date)} 21:25 开奖
              </p>
            )}
          </div>
        )}
      </section>

      {user && summary.data && (
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="text-sm text-slate-500">总投入</p>
            <p className="mt-1 text-2xl font-semibold">
              {formatMoney(summary.data.total_cost + summary.data.pending_cost)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">累计中奖</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(summary.data.total_prize)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">净盈亏</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                summary.data.net >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatMoney(summary.data.net)}
            </p>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">最近 5 期</h2>
        {recent.data?.items?.length ? (
          <ul className="divide-y divide-slate-100">
            {recent.data.items.map((draw) => (
              <li key={draw.draw_no} className="flex flex-wrap items-center gap-3 py-2.5">
                <Link
                  to={`/draws/${draw.draw_no}`}
                  className="w-20 shrink-0 font-medium text-brand-600 hover:underline"
                >
                  {draw.draw_no}
                </Link>
                <Balls front={draw.front_numbers} back={draw.back_numbers} size="sm" />
                <span className="ml-auto text-xs text-slate-400">{draw.draw_date}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">暂无数据</p>
        )}
      </section>
    </div>
  );
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `¥${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function formatDrawDate(value: string): string {
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${Number(parts[1])} 月 ${Number(parts[2])} 日`;
}
