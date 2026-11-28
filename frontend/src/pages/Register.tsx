import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    try {
      await register(username.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <div className="card space-y-4">
        <h1 className="text-lg font-semibold">注册</h1>
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="label">用户名（3–32 位字母、数字、下划线或短横线，不区分大小写）</label>
            <input
              className="input"
              value={username}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div>
            <label className="label">密码（至少 8 位）</label>
            <input
              className="input"
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="label">确认密码</label>
            <input
              className="input"
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "注册中…" : "注册"}
          </button>
        </form>
        <p className="text-sm text-slate-500">
          已有账号？
          <Link to="/login" className="ml-1 text-brand-600 hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
