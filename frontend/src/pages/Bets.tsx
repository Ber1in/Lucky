import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type Bet } from "../api";
import { useAuth } from "../auth";
import { Balls } from "../components/Balls";
import { formatMoney } from "./Home";

const PAGE_SIZE = 20;

function emptyFront() {
  return ["", "", "", "", ""];
}

function statusLabel(bet: Bet) {
  if (bet.status === "pending") return "待开奖";
  if (bet.status === "won") return `中奖 · ${bet.prize_level ?? ""}`;
  return "未中奖";
}

export function Bets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [drawNo, setDrawNo] = useState("");
  const [front, setFront] = useState<string[]>(emptyFront());
  const [back, setBack] = useState<string[]>(["", ""]);
  const [additional, setAdditional] = useState(false);
  const [multiplier, setMultiplier] = useState(2);
  const [ticketAmount, setTicketAmount] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const bets = useQuery({
    queryKey: ["bets", page],
    queryFn: () => api.bets(page, PAGE_SIZE),
    enabled: !!user,
  });
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary, enabled: !!user });
  const nextDraw = useQuery({
    queryKey: ["next-draw"],
    queryFn: api.nextDraw,
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!drawNo && editingId === null && nextDraw.data?.draw_no) {
      setDrawNo(nextDraw.data.draw_no);
    }
  }, [nextDraw.data, drawNo, editingId]);

  if (!user) {
    return (
      <div className="card">
        <p className="text-sm text-slate-600">登录后才能记录和查看投注。</p>
        <div className="mt-3 flex gap-2">
          <Link className="btn-primary" to="/login">
            去登录
          </Link>
          <Link className="btn-ghost" to="/register">
            注册
          </Link>
        </div>
      </div>
    );
  }

  if (bets.isError) {
    return (
      <div className="card">
        <p className="text-sm text-red-600">投注记录加载失败，请重新登录或稍后重试。</p>
      </div>
    );
  }

  const totalPages = bets.data ? Math.max(1, Math.ceil(bets.data.total / PAGE_SIZE)) : 1;
  const costPreview = (additional ? 3 : 2) * multiplier;

  const resetForm = () => {
    setDrawNo("");
    setFront(emptyFront());
    setBack(["", ""]);
    setAdditional(false);
    setMultiplier(2);
    setTicketAmount("");
    setEditingId(null);
  };

  const submit = async () => {
    setError("");
    setNotice("");
    const effectiveDrawNo = drawNo.trim();
    if (effectiveDrawNo && !/^\d{5}$/.test(effectiveDrawNo)) {
      setError("期号必须为 5 位数字，或留空使用下一期");
      return;
    }
    if (front.some((value) => !value) || back.some((value) => !value)) {
      setError("请填写全部 7 个号码");
      return;
    }
    const frontNumbers = front.map((value) => Number(value));
    const backNumbers = back.map((value) => Number(value));
    if (
      frontNumbers.some((number) => !Number.isInteger(number) || number < 1 || number > 35) ||
      new Set(frontNumbers).size !== 5
    ) {
      setError("前区必须为 5 个不重复的 01–35 号码");
      return;
    }
    if (
      backNumbers.some((number) => !Number.isInteger(number) || number < 1 || number > 12) ||
      new Set(backNumbers).size !== 2
    ) {
      setError("后区必须为 2 个不重复的 01–12 号码");
      return;
    }
    if (!Number.isInteger(multiplier) || multiplier < 2 || multiplier > 99) {
      setError("倍数必须为 2–99 的整数");
      return;
    }
    const parsedTicketAmount = ticketAmount ? Number(ticketAmount) : null;
    if (
      parsedTicketAmount !== null &&
      (!Number.isFinite(parsedTicketAmount) ||
        parsedTicketAmount < 0 ||
        parsedTicketAmount > 30000)
    ) {
      setError("整张票金额必须在 0–30000 之间");
      return;
    }
    try {
      if (editingId !== null) {
        await api.updateBet(editingId, {
          front_numbers: frontNumbers,
          back_numbers: backNumbers,
          is_additional: additional,
          multiplier,
          ticket_amount: parsedTicketAmount,
        });
        setNotice("已更新");
      } else {
        await api.createBet({
          draw_no: effectiveDrawNo || null,
          front_numbers: frontNumbers,
          back_numbers: backNumbers,
          is_additional: additional,
          multiplier,
          ticket_amount: parsedTicketAmount,
        });
        setNotice("已记录");
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["bets"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  };

  const startEdit = (bet: Bet) => {
    setEditingId(bet.id);
    setDrawNo(bet.draw_no);
    setFront(bet.front_numbers.map((number) => String(number)));
    setBack(bet.back_numbers.map((number) => String(number)));
    setAdditional(bet.is_additional);
    setMultiplier(bet.multiplier);
    setTicketAmount(bet.ticket_amount != null ? String(bet.ticket_amount) : "");
    setError("");
    setNotice("");
  };

  const remove = async (bet: Bet) => {
    if (!window.confirm(`删除第 ${bet.draw_no} 期的这条记录？`)) return;
    try {
      await api.deleteBet(bet.id);
      queryClient.invalidateQueries({ queryKey: ["bets"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">我的投注</h1>

      {summary.data && (
        <section className="grid gap-4 sm:grid-cols-4">
          <div className="card">
            <p className="text-sm text-slate-500">已结算投入</p>
            <p className="mt-1 text-xl font-semibold">{formatMoney(summary.data.total_cost)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">累计中奖</p>
            <p className="mt-1 text-xl font-semibold">{formatMoney(summary.data.total_prize)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">净盈亏</p>
            <p
              className={`mt-1 text-xl font-semibold ${
                summary.data.net >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {formatMoney(summary.data.net)}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-slate-500">待开奖</p>
            <p className="mt-1 text-xl font-semibold">
              {summary.data.pending_count} 注 · {formatMoney(summary.data.pending_cost)}
            </p>
          </div>
        </section>
      )}

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{editingId ? "修改投注" : "录入投注"}</h2>
          {editingId && (
            <button className="text-sm text-slate-500 hover:text-brand-600" onClick={resetForm}>
              取消修改
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">期号（留空默认下一期）</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={drawNo}
                disabled={editingId !== null}
                placeholder="自动使用下一期"
                onChange={(event) => setDrawNo(event.target.value.trim())}
              />
              {nextDraw.data?.draw_no && (
                <button
                  type="button"
                  className="btn-ghost shrink-0"
                  onClick={() => setDrawNo(nextDraw.data?.draw_no ?? "")}
                >
                  下一期
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="label">倍数（2–99）</label>
            <input
              className="input"
              type="number"
              min={2}
              max={99}
              value={multiplier}
              onChange={(event) => setMultiplier(Number(event.target.value))}
            />
          </div>
          <div>
            <label className="label">整张票金额（可选）</label>
            <input
              className="input"
              type="number"
              min={0}
              max={30000}
              value={ticketAmount}
              placeholder="默认本注金额"
              onChange={(event) => setTicketAmount(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">前区（01–35，5 个）</label>
          <div className="flex flex-wrap gap-2">
            {front.map((value, index) => (
              <input
                key={`front-${index}`}
                className="input w-16 text-center"
                inputMode="numeric"
                value={value}
                placeholder="--"
                onChange={(event) => {
                  const next = [...front];
                  next[index] = event.target.value.replace(/\D/g, "").slice(0, 2);
                  setFront(next);
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="label">后区（01–12，2 个）</label>
          <div className="flex gap-2">
            {back.map((value, index) => (
              <input
                key={`back-${index}`}
                className="input w-16 text-center"
                inputMode="numeric"
                value={value}
                placeholder="--"
                onChange={(event) => {
                  const next = [...back];
                  next[index] = event.target.value.replace(/\D/g, "").slice(0, 2);
                  setBack(next);
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={additional}
              onChange={(event) => setAdditional(event.target.checked)}
            />
            追加（每注 +1 元）
          </label>
          <span className="text-slate-500">本注投入：¥{costPreview}</span>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-600">{notice}</p>}

        <button className="btn-primary" onClick={submit}>
          {editingId ? "保存修改" : "记录投注"}
        </button>
        <p className="text-xs text-slate-400">
          仅支持 26014 期及以后；期号留空时自动使用下一期（尚未开奖），开奖后自动核算。
        </p>
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">期号</th>
              <th className="px-4 py-3 font-medium">号码</th>
              <th className="px-4 py-3 font-medium">投入</th>
              <th className="px-4 py-3 font-medium">结果</th>
              <th className="px-4 py-3 font-medium">奖金</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bets.data?.items.map((bet) => (
              <tr key={bet.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{bet.draw_no}</div>
                  <div className="text-xs text-slate-400">{bet.draw_date ?? "待开奖"}</div>
                </td>
                <td className="px-4 py-3">
                  <Balls front={bet.front_numbers} back={bet.back_numbers} size="sm" />
                  <div className="mt-1 text-xs text-slate-400">
                    {bet.is_additional ? "追加" : "基本"} · {bet.multiplier} 倍
                  </div>
                </td>
                <td className="px-4 py-3">{formatMoney(bet.cost)}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      bet.status === "won"
                        ? "font-medium text-emerald-600"
                        : bet.status === "pending"
                          ? "text-amber-600"
                          : "text-slate-500"
                    }
                  >
                    {statusLabel(bet)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {bet.status === "won" ? formatMoney(bet.prize_amount) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 text-sm">
                    <button className="text-brand-600 hover:underline" onClick={() => startEdit(bet)}>
                      修改
                    </button>
                    <button className="text-red-500 hover:underline" onClick={() => remove(bet)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!bets.data?.items.length && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>
                  还没有投注记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-end gap-2">
        <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <span className="text-sm text-slate-500">
          第 {page} / {totalPages} 页
        </span>
        <button
          className="btn-ghost"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
