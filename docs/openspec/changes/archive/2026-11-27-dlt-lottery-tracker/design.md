---
comet_change: dlt-lottery-tracker
role: technical-design
canonical_spec: openspec
archived-with: 2026-11-27-dlt-lottery-tracker
status: final
---

# Design

## Context

全新项目，无既有代码。约束来自 proposal.md 与已确认的产品决策：

- 单台阿里云 ECS，无域名，仅 IP 访问，暂用 HTTP。
- 后端 Python，前端 React，前后端分离但同源部署。
- 官方接口有 WAF：必须 HTTPS + 浏览器 UA + 任意 Referer；`pageSize` 上限 100；全量约 2953 期。
- 开奖时间：每周一、三、六 21:25（北京时间），结果约 21:35 可查。
- 奖级规则只对现行七等奖制（26014 期起）做自动核算；更早期次仅展示，不支持投注录入。
- 本期认证只做用户名/密码，无邮件、无手机号。

## Goals / Non-Goals

**Goals:**

- 单机部署，零外部托管依赖，数据可整库备份。
- 同步幂等、失败可重试、过程可观测。
- 奖级规则独立成表，未来规则再变时只需新增映射。
- 前后端职责清晰，但对外只暴露一个端口。

**Non-Goals:**

- 多实例、水平扩展、分布式锁。
- 高可用、CDN、HTTPS（本期不做）。
- 复式、胆拖、机选、中奖通知。

## Decisions

### 1. 部署拓扑：单机 Docker Compose

```text
Browser
  |
  v
Nginx :8080
  |-- /        --> React 静态文件
  |-- /api/*   --> FastAPI :8000
                      |
                      v
                 PostgreSQL :5432
worker ------------------> 官方接口 + PostgreSQL
```

- 一个端口对外，避免跨域和两个地址，Cookie 认证也不需要处理跨站。
- 备选：前后端各自端口 + CORS，配置更碎且无收益；K8s，单机场景过度设计。

### 2. 后端：FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2

- 理由：Python 生态成熟，Pydantic 负责输入校验，自动生成 OpenAPI 便于前后端对齐契约。
- 业务接口使用同步 `def` + 同步 Session，避免 async 与同步驱动混用的复杂度；只有外部抓取用 `httpx`。
- 备选：Django（ORM/Admin 用不上，偏重）、Flask（校验和文档要自己补）。

### 3. 认证：数据库会话 + HttpOnly Cookie

- 用户名 + 密码；密码用 Argon2id（`argon2-cffi`）哈希。
- 会话表保存 token 的 SHA-256 摘要；浏览器 Cookie 保存原始随机 token，`HttpOnly`、`SameSite=Lax`、`Path=/`。
- 理由：同源部署下 Cookie 最简单，服务端可即时吊销会话；JWT 无法撤销，还要额外处理刷新。
- 备选：JWT（无状态但吊销麻烦）、Redis 会话（单机多一个组件，不必要）。
- 登录失败统一返回 401，不区分“用户不存在/密码错误”；按 IP + 用户名限流。
- 忘记密码不依赖邮件：提供管理员 CLI 重置命令。

### 4. 数据同步：独立 worker + APScheduler

- worker 启动时：表为空或本地期数少于官方 `total` → 全量回填；否则按页补齐所有比本地更新的期次，最多回溯 50 页。
- 定时：`CronTrigger(day_of_week='mon,wed,sat', hour=21, minute=35, timezone='Asia/Shanghai')`。
- 每次触发拉最新一页，写入所有比本地最新的期次；若没有新期次，按 5 分钟重试，最多 12 次，最终记录 `no_update`；只有真正写入新期次才记 `success`。
- 幂等：`draw_no` 唯一键 + upsert；每写入一期立即核算该期的待开奖投注。
- 补跑：提供 `python -m app.cli sync`（单次、不重试）与 `backfill`，便于漏跑后修复。
- 备选：系统 cron 调 CLI（可行，但容器内多一个进程；APScheduler 更内聚）。

### 5. 外部数据源适配层

- 主源：`https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry`，`gameNo=85`、`pageSize=100`。
- 请求头必须带浏览器 UA 和任意 `Referer`，服务端用 `httpx` 发起，超时 15 秒，失败重试 3 次。
- 解析字段：`lotteryDrawNum`、`lotteryDrawTime`、`lotteryDrawResult`（前 5 + 后 2）、`poolBalanceAfterdraw`、`prizeLevelList`。
- 备用源：500.com XML（全量、轻量）用于号码兜底；中彩网 JSONP（含追加分列）用于奖级兜底。
- 原始响应写入 `raw_payload` JSONB，规则变化后可回溯。
- 备选：前端直连，不可行（WAF + CORS）。

### 6. 数据模型

| 表 | 关键字段 |
|---|---|
| `users` | `id`, `username` unique, `password_hash`, `created_at` |
| `sessions` | `id`, `user_id`, `token_hash` unique, `expires_at`, `created_at`, `last_seen_at` |
| `draws` | `draw_no` PK, `draw_date`, `front_numbers json`（5 个 1–35 整数）, `back_numbers json`（2 个 1–12 整数）, `pool_balance`, `sales_amount`, `rule_version`, `raw_payload json`, `synced_at` |
| `draw_prizes` | `id`, `draw_no`, `prize_level`, `stake_amount`, `stake_count`, `group_code`, `sort` |
| `bets` | `id`, `user_id`, `draw_no`, `front_numbers json`, `back_numbers json`, `is_additional`, `multiplier`, `cost`, `ticket_amount`, `status`, `prize_level`, `prize_amount`, `created_at`, `updated_at` |
| `sync_runs` | `id`, `started_at`, `finished_at`, `status`, `attempts`, `message` |

- 号码数组的长度与取值范围由应用层校验保证；PostgreSQL 侧可追加 JSON 长度 CHECK。
- `draws.rule_version` 取值为 `seven_tier`（26014 期起）或 `legacy`（更早）。
- 索引：`bets(user_id, draw_no)`、`draws(draw_date)`、`sessions(token_hash)`、`sessions(expires_at)`。

### 7. 奖级规则引擎

只实现现行七等奖制，映射写成代码中的只读表：

- `seven_tier`：`5+2`→一，`5+1`→二，`5+0`/`4+2`→三，`4+1`→四，`4+0`/`3+2`→五，`3+1`/`2+2`→六，`3+0`/`2+1`/`1+2`/`0+2`→七。
- 26014 期之前的期次标记为 `legacy`，只展示开奖号码与接口返回的奖级明细；投注接口拒绝这些期号。

金额处理：

- 一律从 `draw_prizes` 按奖级名称取单注奖金，不硬编码。
- 追加只对一、二等奖生效，奖金为基本单注奖金的 80%；不依赖接口里的“追加”条目，避免重复计算。
- 派奖期：若该期存在 `{奖级}派奖` 条目，且 `ticket_amount >= 18`，加总派奖金额；`ticket_amount` 为空时按本注投入判断。
- 最终奖金 = 单注奖金 × 倍数。

### 8. API 设计（统一前缀 `/api`）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 用户名 + 密码注册 |
| POST | `/auth/login` | 登录，设置会话 Cookie |
| POST | `/auth/logout` | 登出并吊销会话 |
| GET | `/auth/me` | 当前用户 |
| GET | `/draws` | 分页历史，沿用 `page` / `pageSize` |
| GET | `/draws/latest` | 最新一期 |
| GET | `/draws/next` | 下一期期号（最大期号 +1，年末进位） |
| GET | `/draws/{drawNo}` | 单期详情 |
| GET | `/insights/numbers` | `window=all\|last100\|last1y` |
| GET | `/bets` | 当前用户投注列表 |
| POST | `/bets` | 录入投注 |
| PATCH | `/bets/{id}` | 修改投注 |
| DELETE | `/bets/{id}` | 删除投注 |
| GET | `/bets/summary` | 投入/中奖/盈亏汇总 |

- 错误统一使用 FastAPI 的 `{detail}` 结构；状态码使用 400/401/404/409/422。
- 时间统一 `Asia/Shanghai`；日期用 `date`，时间戳用带时区 ISO 8601。

### 9. 前端

- React 18 + Vite + TypeScript + Tailwind。
- 路由 React Router，数据请求 TanStack Query，表单 React Hook Form + Zod。
- 页面：首页（最新一期 + 最近若干期）、历史列表、单期详情、号码统计、我的投注、登录/注册。
- 会话通过 `/auth/me` 探测；任何 401 统一跳登录。
- 号码频率用横向条形图；优先纯 CSS 实现，避免为一张图引入重库。
- 移动端优先的响应式布局。

### 10. 安全

- Argon2id 哈希，密码至少 8 位。
- 注册与登录都限流；登录失败信息统一。
- 全部 SQL 参数化（ORM），输入做范围、去重、期号存在性校验。
- Cookie `HttpOnly` + `SameSite=Lax`；将来上 HTTPS 时追加 `Secure`。

### 11. 部署与运维

- `docker-compose.yml` 四个服务：`nginx`、`api`、`worker`、`db`。
- `.env`：`DATABASE_URL`、`SECRET_KEY`、`TZ=Asia/Shanghai`。
- 数据卷 `pgdata`；宿主机每日 `pg_dump` 备份。
- 健康检查：`/api/health`。
- 升级：`docker compose build && alembic upgrade head && docker compose up -d`。

## Testing Strategy

- **后端单元与接口测试**：pytest + 固定响应夹具，覆盖认证（注册/登录/会话/限流/隔离）、同步幂等与重试、规则版本边界、投注输入校验、奖级与奖金计算。
- **规则边界**：26013/26014 期号边界、奖池 <8 亿 / ≥8 亿固定奖、追加一/二等奖、倍数。
- **前端**：手工验收为主（页面与接口一致性、时间窗切换、响应式、401 跳转），`npm run build` 作为构建门槛。
- **集成**：Docker Compose 端到端跑通“注册 → 录入投注 → 同步开奖 → 查看中奖”。
- **真实数据校验**：全量回填后核对期数与官方 `total` 一致，并抽查一期的奖级明细。

## Risks / Trade-offs

- **HTTP 明文 + 开放注册** → 强哈希、登录限流、`SameSite` Cookie 已能挡住大部分风险；上线前应补域名与 TLS。风险已知并接受。
- **官方接口 WAF 变更** → 适配层隔离、原始响应留档、500.com 兜底。
- **历史期次不可核算** → 26014 期之前的投注无法自动判奖，这是本期明确的范围限制；录入页需明确提示，避免用户误录。
- **奖池阈值导致固定奖浮动** → 金额一律取接口返回值，不写死。
- **派奖期奖级条目数量不固定** → 按奖级名称过滤，不假设条目数。
- **定时任务漏跑** → 启动时比较本地期数与官方 `total` 并补齐、按页向前回溯、幂等 upsert、手动 CLI 补跑。
- **单机故障** → 每日备份，容器可重建；不做高可用。
- **开放注册被滥用** → 注册限流；后续可加邀请码开关。

## Migration Plan

1. 服务器安装 Docker 与 Compose。
2. 拉取代码，配置 `.env`。
3. 启动 `db`，执行 `alembic upgrade head`。
4. 启动 `api` 与 `worker`；worker 首次启动自动回填历史。
5. Nginx 对外暴露 8080，验证首页、统计、注册登录、投注录入。
6. 回滚：保留上一版镜像 tag；数据库变更前先 `pg_dump`。

## Open Questions

无。六等奖制映射的核对属于实现任务，已在 Risks 中给出降级方案。
