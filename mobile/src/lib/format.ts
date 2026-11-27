export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return `¥${Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

export function formatDrawDate(value: string): string {
  const parts = value.split("-");
  if (parts.length !== 3) {
    return value;
  }
  return `${Number(parts[1])} 月 ${Number(parts[2])} 日`;
}

export const pad = (value: number) => String(value).padStart(2, "0");

export function statusLabel(status: string, prizeLevel: string | null): string {
  if (status === "pending") return "待开奖";
  if (status === "won") return `中奖 · ${prizeLevel ?? ""}`;
  return "未中奖";
}
