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

export type NumberStat = { number: number; count: number; pct: number; omission: number | null };

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

export type DrawSummary = {
  draw_no: string;
  cost: number;
  prize: number;
  net: number;
  settled: boolean;
};

export type Summary = {
  total_cost: number;
  total_prize: number;
  net: number;
  pending_cost: number;
  pending_count: number;
  bet_count: number;
  by_draw: DrawSummary[];
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { protected?: boolean },
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 && options?.protected) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    let message = `请求失败（${response.status}）`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        message = body.detail.map((item: { msg?: string }) => item.msg ?? "").join("；");
      }
    } catch {
      // Keep the default message
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  me: () => request<User>("/auth/me"),
  login: (username: string, password: string) =>
    request<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  latest: () => request<Draw>("/draws/latest"),
  nextDraw: () => request<{ draw_no: string; draw_date: string }>("/draws/next"),
  draws: (page = 1, pageSize = 20) =>
    request<DrawList>(`/draws?page=${page}&pageSize=${pageSize}`),
  draw: (drawNo: string) => request<Draw>(`/draws/${drawNo}`),
  insights: (window: string, includeNine = false, includeSix = false) =>
    request<Insights>(
      `/insights/numbers?window=${window}&include_nine_tier=${includeNine}&include_six_tier=${includeSix}`,
    ),
  bets: (page = 1, pageSize = 20) =>
    request<BetList>(`/bets?page=${page}&pageSize=${pageSize}`, undefined, { protected: true }),
  summary: () => request<Summary>("/bets/summary", undefined, { protected: true }),
  createBet: (payload: {
    draw_no?: string | null;
    front_numbers: number[];
    back_numbers: number[];
    is_additional: boolean;
    multiplier: number;
    ticket_amount?: number | null;
  }) => request<Bet>("/bets", { method: "POST", body: JSON.stringify(payload) }, { protected: true }),
  updateBet: (
    id: number,
    payload: {
      front_numbers?: number[];
      back_numbers?: number[];
      is_additional?: boolean;
      multiplier?: number;
      ticket_amount?: number | null;
    },
  ) =>
    request<Bet>(`/bets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, { protected: true }),
  deleteBet: (id: number) =>
    request<void>(`/bets/${id}`, { method: "DELETE" }, { protected: true }),
};
