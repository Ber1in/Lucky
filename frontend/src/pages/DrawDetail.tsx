import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Balls } from "../components/Balls";
import { formatMoney } from "./Home";

export function DrawDetail() {
  const { drawNo = "" } = useParams();
  const query = useQuery({ queryKey: ["draw", drawNo], queryFn: () => api.draw(drawNo) });

  if (query.isLoading) return <p className="text-sm text-slate-500">加载中…</p>;
  if (query.isError || !query.data) {
    return (
      <div className="card">
        <p className="text-sm text-red-600">该期不存在或加载失败。</p>
        <Link to="/history" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
          返回历史列表
        </Link>
      </div>
    );
  }

  const draw = query.data;
  return (
    <div className="space-y-5">
      <Link to="/history" className="text-sm text-slate-500 hover:text-brand-600">
        ← 返回历史列表
      </Link>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold">第 {draw.draw_no} 期</h1>
          <span className="text-sm text-slate-500">{draw.draw_date}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {draw.rule_version === "seven_tier" ? "七等奖制" : "历史规则（仅展示）"}
          </span>
        </div>
        <Balls front={draw.front_numbers} back={draw.back_numbers} />
        <div className="flex flex-wrap gap-6 text-sm text-slate-500">
          <span>奖池：{formatMoney(draw.pool_balance)}</span>
          <span>本期销售：{formatMoney(draw.sales_amount)}</span>
        </div>
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">奖级</th>
              <th className="px-4 py-3 font-medium">单注奖金</th>
              <th className="px-4 py-3 font-medium">中奖注数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {draw.prizes.map((prize) => (
              <tr key={prize.prize_level}>
                <td className="px-4 py-3">{prize.prize_level}</td>
                <td className="px-4 py-3">{formatMoney(prize.stake_amount)}</td>
                <td className="px-4 py-3 text-slate-500">{prize.stake_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
