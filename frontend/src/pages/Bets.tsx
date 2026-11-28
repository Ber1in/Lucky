import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, type Bet } from "../api";
import { useAuth } from "../auth";
import { Balls } from "../components/Balls";
import { Pagination } from "../components/Pagination";
import { formatMoney } from "./Home";

function statusLabel(bet: Bet) {
  if (bet.status === "pending") return "待开奖";
  if (bet.status === "won") return `中奖 · ${bet.prize_level ?? ""}`;
  return "未中奖";
}

function NumberGrid({
  max,
  selected,
  onToggle,
  color,
}: {
  max: number;
  selected: number[];
  onToggle: (value: number) => void;
  color: "front" | "back";
}) {
  const total = color === "front" ? 35 : 12;
  return (
    <div
      data-testid={`${color}-grid`}
      className={`grid gap-2 ${
        color === "front" ? "grid-cols-7 sm:grid-cols-9" : "grid-cols-6 sm:grid-cols-12"
      }`}
    >
      {Array.from({ length: total }, (_, index) => index + 1).map((value) => {
        const isSelected = selected.includes(value);
        const disabled = !isSelected && selected.length >= max;
        return (
          <button
            type="button"
            key={value}
            disabled={disabled}
            onClick={() => onToggle(value)}
            className={`h-9 rounded-full text-sm font-semibold transition ${
              isSelected
                ? color === "front"
                  ? "bg-brand-600 text-white"
                  : "bg-sky-600 text-white"
                : disabled
                  ? "bg-slate-100 text-slate-300"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {String(value).padStart(2, "0")}
          </button>
        );
      })}
    </div>
  );
}

export function Bets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [drawNo, setDrawNo] = useState("");
  const [front, setFront] = useState<number[]>([]);
  const [back, setBack] = useState<number[]>([]);
  const [additional, setAdditional] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [ticketAmount, setTicketAmount] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const bets = useQuery({
    queryKey: ["bets", page, pageSize],
    queryFn: () => api.bets(page, pageSize),
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
    if (!drawNo && nextDraw.data?.draw_no) {
      setDrawNo(nextDraw.data.draw_no);
    }
  }, [nextDraw.data, drawNo]);

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

  const totalPages = bets.data ? Math.max(1, Math.ceil(bets.data.total / pageSize)) : 1;
  const costPreview = (additional ? 3 : 2) * multiplier;

  const toggleFront = (value: number) => {
    if (front.includes(value)) {
      setFront(front.filter((item) => item !== value));
    } else if (front.length < 5) {
      setFront([...front, value].sort((a, b) => a - b));
    }
  };

  const toggleBack = (value: number) => {
    if (back.includes(value)) {
      setBack(back.filter((item) => item !== value));
    } else if (back.length < 2) {
      setBack([...back, value].sort((a, b) => a - b));
    }
  };

  const resetForm = () => {
    setDrawNo("");
    setFront([]);
    setBack([]);
    setAdditional(false);
    setMultiplier(1);
    setTicketAmount("");
    setShowForm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
    setManaging(false);
    setSelected([]);
  };

  const submit = async () => {
    setError("");
    setNotice("");
    const effectiveDrawNo = drawNo.trim();
    if (effectiveDrawNo && !/^\d{5}$/.test(effectiveDrawNo)) {
      setError("期号必须为 5 位数字，或留空使用下一期");
      return;
    }
    if (front.length !== 5) {
      setError("前区请点选 5 个号码");
      return;
    }
    if (back.length !== 2) {
      setError("后区请点选 2 个号码");
      return;
    }
    if (!Number.isInteger(multiplier) || multiplier < 1 || multiplier > 99) {
      setError("倍数必须为 1–99 的整数");
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
      await api.createBet({
        draw_no: effectiveDrawNo || null,
        front_numbers: front,
        back_numbers: back,
        is_additional: additional,
        multiplier,
        ticket_amount: parsedTicketAmount,
      });
      setNotice("已记录");
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["bets"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  };

  const toggleSelected = (id: number) => {
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  };

  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!window.confirm(`删除选中的 ${selected.length} 条投注记录？`)) return;
    setError("");
    try {
      await Promise.all(selected.map((id) => api.deleteBet(id)));
      setSelected([]);
      setManaging(false);
      queryClient.invalidateQueries({ queryKey: ["bets"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">我的投注</h1>
        <div className="flex gap-2">
          {!showForm && !managing && (
            <>
              <button className="btn-primary" onClick={openCreate}>
                记录投注
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  setManaging(true);
                  setSelected([]);
                }}
              >
                管理
              </button>
            </>
          )}
          {managing && (
            <>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700"
                disabled={!selected.length}
                onClick={deleteSelected}
              >
                删除选中（{selected.length}）
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  setManaging(false);
                  setSelected([]);
                }}
              >
                取消
              </button>
            </>
          )}
        </div>
      </div>

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

      {showForm && (
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">记录投注</h2>
          <button className="text-sm text-slate-500 hover:text-brand-600" onClick={resetForm}>
            取消
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">期号（留空默认下一期）</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={drawNo}
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
            <label className="label">倍数（1–99）</label>
            <input
              className="input"
              type="number"
              min={1}
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
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">前区（点选 5 个）</label>
            <span className="text-xs text-slate-400">{front.length} / 5</span>
          </div>
          <NumberGrid max={5} selected={front} onToggle={toggleFront} color="front" />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">后区（点选 2 个）</label>
            <span className="text-xs text-slate-400">{back.length} / 2</span>
          </div>
          <NumberGrid max={2} selected={back} onToggle={toggleBack} color="back" />
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
          记录投注
        </button>
        <p className="text-xs text-slate-400">
          仅支持 26014 期及以后；期号留空时自动使用下一期（尚未开奖），开奖后自动核算。
        </p>
      </section>
      )}

      <section className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {managing && <th className="px-4 py-3 font-medium">选择</th>}
              <th className="px-4 py-3 font-medium">期号</th>
              <th className="px-4 py-3 font-medium">号码</th>
              <th className="px-4 py-3 font-medium">投入</th>
              <th className="px-4 py-3 font-medium">结果</th>
              <th className="px-4 py-3 font-medium">奖金</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bets.data?.items.map((bet) => (
              <tr
                key={bet.id}
                className={`hover:bg-slate-50 ${managing ? "cursor-pointer" : ""}`}
                onClick={managing ? () => toggleSelected(bet.id) : undefined}
              >
                {managing && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(bet.id)}
                      onChange={() => toggleSelected(bet.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                )}
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
              </tr>
            ))}
            {!bets.data?.items.length && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={managing ? 6 : 5}>
                  还没有投注记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <Pagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={[5, 10, 15, 30, 50]}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}
