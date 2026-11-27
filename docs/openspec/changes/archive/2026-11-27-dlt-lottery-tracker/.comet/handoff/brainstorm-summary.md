# Brainstorm Summary

- Change: dlt-lottery-tracker
- Date: 2026-11-27

## 确认的技术方案（已确认）

- 部署：单台阿里云 ECS，Docker Compose 编排 `nginx` / `api` / `worker` / `db`，对外仅暴露 8080，Nginx 托管 React 静态文件并反代 `/api`。
- 后端：FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2；同步业务接口，外部抓取用 httpx。
- 认证：用户名 + 密码，Argon2id；数据库会话 + HttpOnly / SameSite=Lax Cookie；登录限流；管理员 CLI 重置密码。
- 同步：独立 worker，APScheduler 在周一/三/六 21:35（Asia/Shanghai）触发；启动时空表自动全量回填；每 5 分钟重试，最多 12 次；`draw_no` 唯一键保证幂等；`sync_runs` 记录结果；提供手动 `sync` CLI。
- 数据源：体彩官方接口（UA + Referer、pageSize=100、约 30 页），原始响应存 JSONB；500.com / 中彩网作为备用。
- 规则：仅七等奖制（26014 期起）；`legacy` 期次只展示、不接受投注录入；固定奖金额取接口，追加仅一/二等奖 ×80%，最终乘倍数。
- 前端：React 18 + Vite + TypeScript + Tailwind + React Router + TanStack Query + React Hook Form/Zod；移动端优先响应式。
- 数据模型：`users`、`sessions`、`draws`、`draw_prizes`、`bets`、`sync_runs`。

## 关键取舍与风险

- HTTP 明文 + 开放注册：接受；用 Argon2id、登录/注册限流、SameSite Cookie 缓解，后续补域名与 TLS。
- 历史期次不可核算：26014 期之前的投注无法自动判奖，录入页必须明确提示。
- 官方接口 WAF 变更：适配层隔离、原始响应留档、备用源兜底。
- 奖池阈值导致固定奖浮动：金额一律取接口，不硬编码。
- 派奖期奖级条目数不固定：按名称过滤，不假设条目数。
- 单机故障：每日 pg_dump，容器可重建，不做高可用。

## 测试策略

- 后端：pytest + 固定响应夹具，覆盖认证、同步幂等、规则边界、投注校验、奖级与奖金、用户隔离。
- 前端：以手工验收为主（页面与接口一致性、响应式、401 跳转）；`npm run build` 作为构建门槛。
- 集成：Docker Compose 端到端跑通注册 → 录入投注 → 同步开奖 → 查看中奖。
- 真实数据：全量回填后核对期数与官方 `total` 一致。

## Spec Patch

无。设计过程中未发现需要新增或修改的验收场景。
