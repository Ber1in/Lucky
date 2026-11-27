# Comet Design Handoff

- Change: dlt-lottery-tracker
- Phase: design
- Mode: compact
- Context hash: a391ecf8214eeb77696b731c93d1794a1a2f55a2e8c5c52a2e10dea7bb9aa66b

Generated-by: comet-handoff.sh
Task hash policy: task-content-v1. Read tasks.md for live completion; excerpts are design-time context.

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## docs/openspec/changes/dlt-lottery-tracker/proposal.md

- Source: docs/openspec/changes/dlt-lottery-tracker/proposal.md
- Lines: 1-39
- SHA256: 7ccd3edccbd610de15940a794c66ae694bedc98c964084cf9690793df18b008d

```md
# Proposal

## Why

目前没有一个工具能同时满足三件事：自动同步大乐透每期开奖、按号码维度做分布统计、记录个人投注并自动核算奖级与盈亏。第三方站点要么数据更新滞后，要么只做展示不做个人核算；更关键的是，大乐透自第 26014 期（2026-02-02）起已由九等奖制改为七等奖制，大量现存工具仍在用旧规则，历史期数还横跨六等奖制、九等奖制两套规则，直接用会算错奖级。

做一个自用、可长期维护的站点，数据源锁定体彩官方接口，规则按开奖期号分段处理。

## What Changes

- 新增开奖数据同步：服务端回填全部历史（约 2953 期），并在每周一、三、六 21:35 后增量拉取；失败重试，写入幂等去重。
- 新增开奖数据展示：最新一期、按期号倒序的历史列表、单期详情（前区/后区号码、奖池、奖级明细）。
- 新增号码统计：前区 1–35、后区 1–12 的出现频率排序与当前遗漏期数，支持“全部历史 / 近 100 期 / 近 1 年”三种时间窗。
- 新增用户体系：用户名 + 密码注册登录，多用户数据隔离。
- 新增投注记录：按期号录入单式号码，支持追加与倍数（2–99），自动计算投入金额。
- 新增奖级核算：仅对 26014 期（2026-02-02 起执行七等奖制）及以后的开奖期次判定奖级与奖金；追加只加一、二等奖（基本奖金的 80%）；汇总累计投入、中奖金额与盈亏。
- **明确不做**：复式、胆拖、机选、邮箱/手机绑定、域名与 HTTPS、支付、中奖通知。这些留到后续 change。
- **明确不做**：26014 期之前的六等奖制、九等奖制投注自动核算。这些期次只展示开奖号码和接口返回的奖级明细，不接受投注录入。

## Capabilities

### New Capabilities

- `draw-data`: 开奖数据的获取、存储、历史回填、定时增量同步，以及按期查询。
- `number-insights`: 前区/后区号码的出现频率与遗漏统计。
- `bet-tracking`: 投注录入、投入金额计算、奖级与奖金判定、盈亏汇总。
- `user-auth`: 用户注册登录、会话管理与用户数据隔离。

### Modified Capabilities

无。项目为全新，暂无既有 spec。

## Impact

- 前端：新增 React + Vite + TypeScript + Tailwind 应用。
- 后端：新增 FastAPI 服务、PostgreSQL 数据库、定时同步 worker。
- 外部依赖：体彩官方开奖接口（需服务端代理并附带浏览器 UA + Referer 以通过 WAF）；500.com / 中彩网作为可选备用源。
- 部署：单台阿里云服务器，Docker Compose 编排 Nginx、API、PostgreSQL、worker，通过 `http://IP:8080` 访问。
- 安全：暂无域名与 HTTPS，密码使用强哈希（Argon2），登录接口限流。

```

## docs/openspec/changes/dlt-lottery-tracker/design.md

- Source: docs/openspec/changes/dlt-lottery-tracker/design.md
- Lines: 1-193
- SHA256: b076451f0e748069b899a421c6be482a38af6ca7edd88f401ec4e57f9a25c5fd

[TRUNCATED]

```md
---
comet_change: dlt-lottery-tracker
role: technical-design
canonical_spec: openspec
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


```

Full source: docs/openspec/changes/dlt-lottery-tracker/design.md

## docs/openspec/changes/dlt-lottery-tracker/tasks.md

- Source: docs/openspec/changes/dlt-lottery-tracker/tasks.md
- Lines: 1-99
- SHA256: 6dfc54fafb9840901ef5f4d6ec1921ceeeb45970d81f56bdc39112427adca35a

[TRUNCATED]

```md
# Tasks

## 1. 项目骨架与运行环境

- [x] 1.1 建立 `backend/`、`frontend/`、`deploy/` 目录与 README 占位文件，验证目录结构符合设计 <!-- comet-task:890f2e19-f0cd-4d29-ba89-f9c07458059c -->
- [x] 1.2 编写 `docker-compose.yml`（nginx/api/worker/db）与 `.env.example`，运行 `docker compose config` 校验通过 <!-- comet-task:9497399c-06af-4829-8288-a29848fcb253 -->
- [x] 1.3 配置 Nginx 托管前端静态文件并反代 `/api` 到 FastAPI，启动后 `curl -I http://localhost:8080/` 返回 200 <!-- comet-task:9215d871-7922-4f82-a961-9806f9305310 -->
- [x] 1.4 实现 `/api/health` 并返回数据库连通状态，`curl /api/health` 返回 200 <!-- comet-task:3290c330-e7de-4b01-b695-fcd89c3f9423 -->
- [x] 1.5 在 README 记录本地启动与服务器部署步骤，按文档命令可完整启动 <!-- comet-task:855a0a56-3e18-4b94-bed2-e07229bbc46b -->

## 2. 数据库与迁移

- [x] 2.1 配置 SQLAlchemy 2.0 + Alembic，在空库执行 `alembic upgrade head` 成功 <!-- comet-task:bc5e6752-1111-43c1-8864-7fcb3a91ec34 -->
- [x] 2.2 建立 `users`、`sessions` 表与约束，迁移成功并用 `\d` 核对字段 <!-- comet-task:dee0d59d-c731-4dd3-9308-3057dbe6eb83 -->
- [x] 2.3 建立 `draws`、`draw_prizes` 表与唯一键、索引，迁移成功并核对约束 <!-- comet-task:fb37259d-0f73-4e3a-9802-586e585d042d -->
- [x] 2.4 建立 `bets`、`sync_runs` 表与索引，迁移成功并核对约束 <!-- comet-task:a54309ee-da03-4ab0-948a-befe9a9b79c7 -->
- [x] 2.5 为数组长度、倍数范围、期号外键编写约束测试，`pytest` 通过 <!-- comet-task:20075487-c180-452a-b5c0-de44264f03c1 -->
- [x] 2.6 新增 `bets.ticket_amount` 字段与 Alembic 迁移，验证迁移成功 <!-- comet-task:358560fb-c2e4-436a-8559-335d22e86d70 -->

## 3. 认证与会话

- [x] 3.1 实现注册接口（Argon2id、用户名唯一、密码长度），测试覆盖成功、重复、短密码 <!-- comet-task:aee49306-2568-4fad-9a23-c27cbfa9e244 -->
- [x] 3.2 实现登录接口与统一 401 错误，测试覆盖正确与错误凭证 <!-- comet-task:34ba9693-73a3-4e04-88e0-c5434c32a7e3 -->
- [x] 3.3 实现会话表、Cookie 下发与 `/auth/me`，测试验证 Cookie 属性和会话读取 <!-- comet-task:6b3f5745-a46d-40f9-bf61-00b186039400 -->
- [x] 3.4 实现登出与过期会话清理，测试验证登出后原 token 失效 <!-- comet-task:af64ff84-7f1a-4d2f-8e1d-21710710e108 -->
- [x] 3.5 实现登录/注册限流，测试在超过阈值后返回 429 <!-- comet-task:810f6daf-aaf0-458e-ad6f-b57780a00166 -->
- [x] 3.6 实现管理员 CLI 重置密码，测试执行后旧密码失效、新密码可登录 <!-- comet-task:918a84f5-2d0f-4797-89c5-e9f10a48f2b3 -->
- [x] 3.7 在 README 补充认证接口与重置密码用法 <!-- comet-task:1a8f05d4-75ff-4952-ade2-c02b8a6e0520 -->

## 4. 开奖数据同步

- [x] 4.1 实现官方接口客户端（UA/Referer、超时、重试、分页），用固定响应夹具测试解析 <!-- comet-task:1377bd56-8934-44ff-83f2-73102a8e85b2 -->
- [x] 4.2 实现全量回填命令，测试在夹具上写入期数正确且重复执行不新增 <!-- comet-task:b743a92c-9714-40bb-ba9e-36bc74f2f7f3 -->
- [x] 4.3 实现奖级明细解析与 `draw_prizes` 落库，测试覆盖奖池 <8 亿 / ≥8 亿两档金额 <!-- comet-task:aba7839c-da5f-4f04-81ad-59c69dadf1be -->
- [x] 4.4 实现规则版本标注（`seven_tier` / `legacy`），测试覆盖 26013/26014 边界 <!-- comet-task:e8109338-362c-4fa8-a648-ded4076b7744 -->
- [x] 4.5 实现 worker 定时任务（周一/三/六 21:35 Asia/Shanghai）与重试，测试成功、未发布重试、超限失败 <!-- comet-task:82df54b7-d32c-43fe-b09b-3ef4c16cbce9 -->
- [x] 4.6 实现 `sync_runs` 记录与失败留痕，测试失败后已有数据不变 <!-- comet-task:56da49c3-75da-4293-9046-e60f83027594 -->
- [x] 4.7 实现手动 `sync` CLI，测试可补跑且幂等 <!-- comet-task:db833885-bc09-42c6-85dd-3f6ac4b13de4 -->
- [x] 4.8 用真实接口跑一次全量回填，核对总期数与官方 `total` 一致 <!-- comet-task:22d79edf-3964-4bcc-ba24-2b95622117df -->

## 5. 开奖查询

- [x] 5.1 实现 `/draws/latest`、`/draws`（分页、倒序）、`/draws/{drawNo}`，测试覆盖分页边界与 404 <!-- comet-task:9ca0e984-c9f0-4103-99f0-19556da9ca6b -->
- [x] 5.2 单期详情返回奖级明细与规则版本，测试核对一条真实期次 <!-- comet-task:505dd630-ffd0-44ac-a0ba-27345841d412 -->
- [x] 5.3 为开奖查询补充 README 示例，验证文档中的请求可直接执行 <!-- comet-task:476f570d-9f5d-4058-9652-20508d88f463 -->
- [x] 5.4 实现下一期查询 `/api/draws/next` 与年末进位，测试 26014/26156/空表 <!-- comet-task:f2849707-9884-488f-9ebc-9e813e874be3 -->

## 6. 号码统计

- [x] 6.1 实现前区/后区频率统计，测试用小型夹具核对次数与排序 <!-- comet-task:1bde73a6-93d4-4d66-a572-0d9dc9b4b02e -->
- [x] 6.2 实现遗漏期数统计，测试覆盖遗漏 0、遗漏 N、从未出现 <!-- comet-task:6d639031-6146-434e-a763-2e49a8be4102 -->
- [x] 6.3 实现三个时间窗与参数校验，测试覆盖 last100 边界和非法值 <!-- comet-task:cab91f72-a671-4456-920e-510beec5a095 -->
- [x] 6.4 统计响应返回样本期数，测试核对期数与窗口一致 <!-- comet-task:94e7f64f-1bb8-4625-a321-e72e3aa064b1 -->
- [x] 6.5 统计页加入“不构成预测依据”提示，手工验证文案可见 <!-- comet-task:c03a4e40-041e-4ea5-8f6d-ea2d1c2d7d5b -->

## 7. 投注记录与奖级核算

- [x] 7.1 实现投注新增接口与输入校验（范围、去重、期号存在、倍数），测试覆盖各类非法输入 <!-- comet-task:889b1841-a85d-4dd7-b344-8d042d903f5c -->
- [x] 7.2 实现投入金额计算，测试覆盖普通/追加 × 倍数 <!-- comet-task:36c6ffb9-4a8e-4969-bb3c-f3c5cb22721e -->
- [x] 7.3 实现七等奖制奖级判定，测试覆盖全部命中组合 <!-- comet-task:ecceac02-cff3-4711-a431-801b9a5cf499 -->
- [x] 7.4 实现历史期次投注拒绝（26014 期之前返回明确错误），测试覆盖 26013/26014 边界 <!-- comet-task:432f9987-9d7b-4f0b-a086-4f83f1322af4 -->
- [x] 7.5 实现奖金计算（固定奖取接口、追加 ×80%、乘倍数），测试覆盖一/二/固定奖与追加 <!-- comet-task:14e3bcc4-ff21-4316-85da-3548ed0d503e -->
- [x] 7.6 实现待开奖状态与开奖后自动重算，测试录入未开奖期次显示待开奖、补数据后自动出结果 <!-- comet-task:57703242-6903-4217-a4c3-b88777692abd -->
- [x] 7.7 实现投注列表/修改/删除与用户隔离，测试跨用户访问返回 403/404 <!-- comet-task:27ce8c1a-b1a2-4341-a0fe-5ffa222f6d11 -->
- [x] 7.8 实现盈亏汇总接口，测试多期投入/中奖/净盈亏 <!-- comet-task:8932ea14-5951-49d0-a0ad-6774f03a4e45 -->
- [x] 7.9 在 README 记录投注与奖级规则说明 <!-- comet-task:acefa2c0-8f2a-42a9-a6f0-24155816075e -->
- [x] 7.10 实现派奖期奖金加总与 18 元门槛（整张票金额字段），测试覆盖 26066 与门槛 <!-- comet-task:004da76c-6085-492d-920c-f8009e1135e7 -->

## 8. 前端

- [x] 8.1 初始化 React + Vite + TS + Tailwind + Router + TanStack Query，`npm run build` 成功 <!-- comet-task:5b04458c-3eb1-4722-8208-9af90868f068 -->
- [x] 8.2 实现登录/注册页与 `/auth/me` 会话探测，手工验证未登录跳转 <!-- comet-task:5343658f-747d-4602-b93d-2823cfd2f370 -->
- [x] 8.3 实现首页（最新一期 + 最近若干期），手工核对与接口数据一致 <!-- comet-task:83438ae8-cbe2-4788-995d-b4b0d8196337 -->
- [x] 8.4 实现历史列表与单期详情，手工验证分页、奖级明细与“历史规则”标注 <!-- comet-task:ad6a8b46-60da-4bef-8af7-53795946e07f -->
- [x] 8.5 实现号码统计页（频率条形图 + 遗漏 + 时间窗切换），手工核对与接口一致 <!-- comet-task:18e597d7-c1e7-43fe-8a94-c935cac16613 -->
- [x] 8.6 实现投注录入页（号码选择、追加、倍数、金额预览），手工验证校验提示与 26014 前不可录入 <!-- comet-task:8cbca651-6dfc-4d0d-bb8d-a1c65f33b743 -->
- [x] 8.7 实现我的投注页（中奖状态、奖级、奖金、盈亏汇总），手工核对 <!-- comet-task:72956bb9-4a30-4ff1-9ab6-852fe624ca02 -->
- [x] 8.8 移动端响应式检查（375px / 768px / 1280px），手工验证无横向滚动 <!-- comet-task:4569fc19-a404-49d6-b810-901d673682df -->
- [x] 8.9 前端加入统一错误与 401 处理，手工验证会话过期跳登录 <!-- comet-task:80bac14d-fbd3-45c4-8d4d-85d04dcbf838 -->
- [x] 8.10 投注表单期号留空默认下一期，手工验证并保留修改/删除 <!-- comet-task:33dcaf6a-e51a-4fd8-9934-f3c4207fcb5b -->

```

Full source: docs/openspec/changes/dlt-lottery-tracker/tasks.md

## docs/openspec/changes/dlt-lottery-tracker/.openspec.yaml

- Source: docs/openspec/changes/dlt-lottery-tracker/.openspec.yaml
- Lines: 1-2
- SHA256: d80b853b48e4aa975645172ad7ef5fa151e0123233d254d536f1f288336f6023

```md
schema: spec-driven
created: 2026-11-27

```

## docs/openspec/changes/dlt-lottery-tracker/specs/bet-tracking/spec.md

- Source: docs/openspec/changes/dlt-lottery-tracker/specs/bet-tracking/spec.md
- Lines: 1-149
- SHA256: 9df04402319febeef642d5a4d21cf954be14766a55100ded846be74ae42f3b71

[TRUNCATED]

```md
# Spec Delta

## Purpose

记录用户按期录入的单式投注，在开奖后按七等奖制判定奖级与奖金，并汇总投入、中奖与盈亏。

## ADDED Requirements

### Requirement: 投注录入

用户 SHALL 能为 26014 期及以后的期次录入一注单式投注，包含前区 5 个不重复号码（01–35）、后区 2 个不重复号码（01–12）、是否追加、2–99 的倍数，以及可选的整张票单期金额；允许该期尚未开奖。未提供期号时，系统 SHALL 使用下一期（本地最大期号 +1）。

#### Scenario: 合法录入

- **WHEN** 用户提交 26014 期及以后的合法期号、5 个前区号、2 个后区号和有效倍数
- **THEN** 系统保存该投注并返回计算后的投入金额

#### Scenario: 未指定期号默认下一期

- **WHEN** 用户提交投注时未提供期号，且本地最大期号为 26014
- **THEN** 系统使用 26015 期并标记为“待开奖”

#### Scenario: 未来期次允许预录

- **WHEN** 用户提交一个尚未开奖、但期号不小于 26014 的期号
- **THEN** 系统保存该投注并标记为“待开奖”

#### Scenario: 历史期次不支持核算

- **WHEN** 用户为 26014 期之前的期次录入投注
- **THEN** 系统拒绝保存并提示该期规则版本不支持自动核算

#### Scenario: 号码越界或重复

- **WHEN** 前区或后区号码越界或存在重复
- **THEN** 系统拒绝保存并返回校验错误

#### Scenario: 非法期号

- **WHEN** 用户提交无法解析的期号
- **THEN** 系统拒绝保存并提示期号无效

### Requirement: 投入金额计算

系统 SHALL 按“单注 2 元、追加加 1 元”计算单注金额，再乘以倍数得到该笔投注金额。

#### Scenario: 普通投注 3 倍

- **WHEN** 用户录入不追加、3 倍的投注
- **THEN** 系统计算投入金额为 6 元

#### Scenario: 追加投注 2 倍

- **WHEN** 用户录入追加、2 倍的投注
- **THEN** 系统计算投入金额为 6 元

### Requirement: 奖级判定

开奖数据到达后，系统 SHALL 按七等奖制判定每注奖级；同一注符合多个奖级时只取最高奖级；全部不满足时标记为未中奖。

#### Scenario: 命中一等奖

- **WHEN** 投注前区命中 5 个且后区命中 2 个
- **THEN** 判定为一等奖

#### Scenario: 七等奖制下 4+2

- **WHEN** 在七等奖制期次中投注前区命中 4 个、后区命中 2 个
- **THEN** 判定为三等奖

#### Scenario: 兼中时取最高

- **WHEN** 一注同时满足多个奖级条件
- **THEN** 系统只按其中最高奖级计奖

#### Scenario: 未命中

- **WHEN** 投注不满足任何奖级条件
- **THEN** 标记为未中奖，奖金为 0


```

Full source: docs/openspec/changes/dlt-lottery-tracker/specs/bet-tracking/spec.md

## docs/openspec/changes/dlt-lottery-tracker/specs/draw-data/spec.md

- Source: docs/openspec/changes/dlt-lottery-tracker/specs/draw-data/spec.md
- Lines: 1-115
- SHA256: 005f77859e5d17aaa2dfc512b6edc66dc3b47522550645a146a655ecdd8cffaa

[TRUNCATED]

```md
# Spec Delta

## Purpose

提供大乐透开奖数据的可靠获取、存储与查询，覆盖历史回填、开奖日增量同步、按期查询和规则版本标注，是号码统计与投注核算的数据基础。

## ADDED Requirements

### Requirement: 历史数据回填

系统 SHALL 能从官方开奖接口回填从 07001 期起的全部历史开奖，并且对同一期号重复回填时保持幂等，不产生重复记录。

#### Scenario: 首次回填全部历史

- **WHEN** 系统首次启动且开奖表为空
- **THEN** 系统按分页拉取全部历史期次并写入，最终期数与官方总数一致

#### Scenario: 重复回填不产生重复

- **WHEN** 对已存在的期号再次执行回填
- **THEN** 该期数据被更新或跳过，开奖表中不出现重复期号

### Requirement: 开奖日增量同步

系统 SHALL 在每周一、三、六北京时间 21:35 之后触发增量同步，拉取最新一期；若官方结果尚未发布，则按固定间隔重试，成功写入后停止。

#### Scenario: 开奖日成功更新

- **WHEN** 开奖日 21:35 后官方接口已返回当期结果
- **THEN** 系统写入新期次，并记录本次同步成功

#### Scenario: 结果尚未发布时重试

- **WHEN** 触发时官方接口仍未返回当期结果
- **THEN** 系统在间隔后重试，直到成功或达到最大尝试次数

#### Scenario: 非开奖日不产生新数据

- **WHEN** 在非开奖日触发同步
- **THEN** 系统不写入新期次，同步结果记录为无更新

### Requirement: 同步结果可观测

系统 SHALL 记录每次同步的触发时间、结果、尝试次数和错误信息，供排查使用。

#### Scenario: 同步失败留痕

- **WHEN** 官方接口请求失败或返回异常结构
- **THEN** 系统记录失败原因与尝试次数，且已有开奖数据不受影响

### Requirement: 开奖数据查询

系统 SHALL 提供最新一期、按期号倒序分页的历史列表和单期详情三种查询。

#### Scenario: 查看最新一期

- **WHEN** 用户打开首页
- **THEN** 系统返回期号最大的开奖记录及其奖级明细

#### Scenario: 分页浏览历史

- **WHEN** 用户请求第 N 页历史
- **THEN** 系统按期号倒序返回对应页数据及总期数

#### Scenario: 查询不存在的期号

- **WHEN** 用户请求一个不存在的期号
- **THEN** 系统返回未找到错误

### Requirement: 下一期查询

系统 SHALL 提供下一期期号查询：取本地最大期号 +1；每年达到 156 期后进位为下一年 001；无历史数据时返回未找到。

#### Scenario: 正常下一期

- **WHEN** 本地最大期号为 26014
- **THEN** 系统返回 26015

#### Scenario: 年末进位


```

Full source: docs/openspec/changes/dlt-lottery-tracker/specs/draw-data/spec.md

## docs/openspec/changes/dlt-lottery-tracker/specs/number-insights/spec.md

- Source: docs/openspec/changes/dlt-lottery-tracker/specs/number-insights/spec.md
- Lines: 1-72
- SHA256: ac317e0a2d3127fd80e176f6b382610c172e5cc59af14cd89cfa3c1bfd443ec4

```md
# Spec Delta

## Purpose

基于历史开奖数据，提供前区与后区号码的出现频率和遗漏统计，让用户能按不同时间窗观察号码分布。

## ADDED Requirements

### Requirement: 号码频率统计

系统 SHALL 分别统计指定时间窗内前区 1–35、后区 1–12 每个号码的出现次数与占比，并按出现次数降序返回。

#### Scenario: 全部历史

- **WHEN** 用户选择“全部历史”时间窗
- **THEN** 系统以全部已同步期次为样本返回前区与后区的频率排序

#### Scenario: 近 100 期

- **WHEN** 用户选择“近 100 期”
- **THEN** 系统只使用最近 100 期计算频率

#### Scenario: 近 1 年

- **WHEN** 用户选择“近 1 年”
- **THEN** 系统只使用开奖日期在最近一年内的期次计算频率

### Requirement: 遗漏期数统计

系统 SHALL 计算每个号码距离最近一次出现的期数差（当前遗漏）；在所选时间窗内从未出现的号码标记为“从未出现”。

#### Scenario: 上期刚出现

- **WHEN** 某号码在最新一期中出现
- **THEN** 该号码遗漏期数为 0

#### Scenario: 长期未出现

- **WHEN** 某号码最近一次出现距今 N 期
- **THEN** 该号码遗漏期数为 N

#### Scenario: 样本内从未出现

- **WHEN** 某号码在所选时间窗内一次都未出现
- **THEN** 系统标记为“从未出现”，不返回数字遗漏值

### Requirement: 时间窗校验

系统 SHALL 只接受“全部历史”“近 100 期”“近 1 年”三个时间窗取值，其他取值返回参数错误。

#### Scenario: 非法时间窗

- **WHEN** 请求传入未定义的时间窗
- **THEN** 系统返回参数错误，不执行统计

### Requirement: 样本量提示

系统 SHALL 在统计结果中返回本次统计实际使用的期数，供用户判断样本大小。

#### Scenario: 返回样本期数

- **WHEN** 用户请求任一时间窗的统计
- **THEN** 响应中包含实际参与计算的期数

### Requirement: 随机性提示

统计页面 SHALL 明确提示开奖为独立随机事件，统计结果不构成预测依据。

#### Scenario: 页面展示提示

- **WHEN** 用户打开统计页面
- **THEN** 页面上可见“统计仅供记录与观察，不构成预测依据”的说明

```

## docs/openspec/changes/dlt-lottery-tracker/specs/user-auth/spec.md

- Source: docs/openspec/changes/dlt-lottery-tracker/specs/user-auth/spec.md
- Lines: 1-86
- SHA256: 9beb10aaae4e2e01a11c349f3d75cb36da5a49c65fa2131bc18b02fa156ab435

[TRUNCATED]

```md
# Spec Delta

## Purpose

提供用户名与密码的注册、登录和会话管理，并保证每个用户只能访问自己的投注数据。

## ADDED Requirements

### Requirement: 用户注册

用户 SHALL 能使用唯一用户名和密码注册；用户名已存在时拒绝注册；密码必须以强哈希形式存储，不得明文保存。

#### Scenario: 成功注册

- **WHEN** 用户提交未被占用的用户名和不少于 8 位的密码
- **THEN** 系统创建账号并返回注册成功

#### Scenario: 用户名重复

- **WHEN** 用户提交已存在的用户名
- **THEN** 系统拒绝注册并返回冲突错误

#### Scenario: 密码过短

- **WHEN** 用户提交少于 8 位的密码
- **THEN** 系统拒绝注册并返回校验错误

### Requirement: 登录

用户 SHALL 能凭用户名和密码登录，成功后获得可用于访问受保护接口的会话凭证。

#### Scenario: 凭证正确

- **WHEN** 用户提交正确的用户名和密码
- **THEN** 系统建立会话并返回会话凭证

#### Scenario: 凭证错误

- **WHEN** 用户提交错误密码或不存在用户名
- **THEN** 系统返回统一的认证失败响应，不暴露账号是否存在

#### Scenario: 登录限流

- **WHEN** 同一来源在短时间内连续登录失败超过阈值
- **THEN** 系统暂时拒绝后续尝试

### Requirement: 会话校验

受保护接口 SHALL 校验会话有效性；缺失、无效或过期会话一律返回未认证。

#### Scenario: 未登录访问

- **WHEN** 未携带有效会话访问受保护接口
- **THEN** 系统返回未认证错误

#### Scenario: 会话过期

- **WHEN** 会话超过有效期后访问受保护接口
- **THEN** 系统拒绝访问并要求重新登录

### Requirement: 登出

用户 SHALL 能主动登出，登出后当前会话立即失效。

#### Scenario: 登出后失效

- **WHEN** 用户登出后再次使用原会话凭证访问
- **THEN** 系统返回未认证错误

### Requirement: 用户数据隔离

投注记录的读取、修改和删除 SHALL 限定在当前登录用户范围内。

#### Scenario: 访问他人数据

- **WHEN** 用户请求其他用户的投注记录
- **THEN** 系统返回无权访问或未找到，不泄露数据是否存在

### Requirement: 密码重置


```

Full source: docs/openspec/changes/dlt-lottery-tracker/specs/user-auth/spec.md
