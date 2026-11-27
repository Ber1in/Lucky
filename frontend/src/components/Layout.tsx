import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const navItems = [
  { to: "/", label: "首页", end: true },
  { to: "/history", label: "历史开奖", end: false },
  { to: "/insights", label: "号码统计", end: false },
  { to: "/bets", label: "我的投注", end: false },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="mr-1 text-lg font-bold text-brand-700">
            大乐透数据站
          </Link>
          <nav className="flex flex-wrap gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm ${
                    isActive
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {user ? (
              <>
                <span className="text-slate-500">{user.username}</span>
                <button
                  className="btn-ghost"
                  onClick={async () => {
                    await logout();
                    navigate("/");
                  }}
                >
                  退出
                </button>
              </>
            ) : (
              <>
                <Link className="btn-ghost" to="/login">
                  登录
                </Link>
                <Link className="btn-primary" to="/register">
                  注册
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-400">
        数据来源：中国体育彩票官方接口。开奖为独立随机事件，统计仅供记录与观察，不构成预测依据。
      </footer>
    </div>
  );
}
