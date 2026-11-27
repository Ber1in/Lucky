import { getBaseUrl } from "./config";
import { clearToken, getToken } from "./token";

export type User = { id: number; username: string };

export type Prize = {
  prize_level: string;
  stake_amount: number | null;
  stake_count: number | null;
};

export type Draw = {
  draw_no: string;
  draw_date: string;
  front_numbers: number[];
  back_numbers: number[];
  pool_balance: number | null;
  sales_amount: number | null;
  rule_version: string;
  prizes: Prize[];
};

export type DrawList = { items: Draw[]; total: number; page: number; page_size: number };

export type NumberStat = {
  number: number;
  count: number;
  pct: number;
  omission: number | null;
};

export type Insights = {
  window: string;
  sample_size: number;
  front: NumberStat[];
  back: NumberStat[];
};

export type Bet = {
  id: number;
  draw_no: string;
  front_numbers: number[];
  back_numbers: number[];
  is_additional: boolean;
  multiplier: number;
  cost: number;
  ticket_amount: number | null;
  status: string;
  prize_level: string | null;
  prize_amount: number | null;
  draw_date: string | null;
};

export type BetList = { items: Bet[]; total: number; page: number; page_size: number };

export type Summary = {
  total_cost: number;
  total_prize: number;
  net: number;
  pending_cost: number;
  pending_count: number;
  bet_count: number;
  by_draw: { draw_no: string; cost: number; prize: number; net: number; settled: boolean }[];
};

export type NextDraw = { draw_no: string; draw_date: string };

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (options.auth !== false) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${getBaseUrl()}/api${path}`, { ...init, headers });

  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        message = body.detail.map((item: { msg?: string }) => item.msg ?? "").join("；");
      }
    } catch {
      // Keep the default message.
    }
    if (response.status === 401 && options.auth !== false) {
      await clearToken();
      unauthorizedHandler?.();
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  tokenLogin: (username: string, password: string) =>
    request<{ token: string; user: User }>(
      "/auth/token",
      { method: "POST", body: JSON.stringify({ username, password }) },
      { auth: false },
    ),
  register: (username: string, password: string) =>
    request<User>(
      "/auth/register",
      { method: "POST", body: JSON.stringify({ username, password }) },
      { auth: false },
    ),
  me: () => request<User>("/auth/me"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  latest: () => request<Draw>("/draws/latest"),
  nextDraw: () => request<NextDraw>("/draws/next"),
  draws: (page = 1, pageSize = 20) =>
    request<DrawList>(`/draws?page=${page}&pageSize=${pageSize}`),
  draw: (drawNo: string) => request<Draw>(`/draws/${drawNo}`),
  insights: (window: string, includeNine = false, includeSix = false) =>
    request<Insights>(
      `/insights/numbers?window=${window}&include_nine_tier=${includeNine}&include_six_tier=${includeSix}`,
    ),
  bets: (page = 1, pageSize = 10) =>
    request<BetList>(`/bets?page=${page}&pageSize=${pageSize}`),
  summary: () => request<Summary>("/bets/summary"),
  createBet: (payload: {
    draw_no?: string | null;
    front_numbers: number[];
    back_numbers: number[];
    is_additional: boolean;
    multiplier: number;
    ticket_amount?: number | null;
  }) => request<Bet>("/bets", { method: "POST", body: JSON.stringify(payload) }),
  updateBet: (
    id: number,
    payload: {
      front_numbers?: number[];
      back_numbers?: number[];
      is_additional?: boolean;
      multiplier?: number;
      ticket_amount?: number | null;
    },
  ) => request<Bet>(`/bets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteBet: (id: number) => request<void>(`/bets/${id}`, { method: "DELETE" }),
};
