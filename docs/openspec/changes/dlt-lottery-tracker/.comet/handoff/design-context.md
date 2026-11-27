# Comet Design Handoff

- Change: dlt-lottery-tracker
- Phase: design
- Mode: compact
- Context hash: e9668dcba0180f342c1cb9617bbea50121b201aa498962578d6bfc228a4b2a7c

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
- Lines: 1-191
- SHA256: c3c2d21c589370f06a40488f152604c19fa631a1e729983215bc2c2e74af5c77

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

- worker 启动时若 `draws` 为空则执行全量回填，否则跳过。
- 定时：`CronTrigger(day_of_week='mon,wed,sat', hour=21, minute=35, timezone='Asia/Shanghai')`。
- 每次触发拉最新一期：若期号已存在则结束；否则每 5 分钟重试，最多 12 次。
- 幂等：`draw_no` 唯一键 + upsert。
- 补跑：提供 `python -m app.cli sync` 手动触发，便于漏跑后修复。
- 备选：系统 cron 调 CLI（可行，但容器内多一个进程；APScheduler 更内聚）。

### 5. 外部数据源适配层


```

Full source: docs/openspec/changes/dlt-lottery-tracker/design.md

## docs/openspec/changes/dlt-lottery-tracker/tasks.md

- Source: docs/openspec/changes/dlt-lottery-tracker/tasks.md
- Lines: 1-89
- SHA256: e88121997ef78512c15cfa4a25fdabad813e74a802767b49af039726434919c5

[TRUNCATED]

```md
# Tasks

## 1. 项目骨架与运行环境

- [ ] 1.1 建立 `backend/`、`frontend/`、`deploy/` 目录与 README 占位文件，验证目录结构符合设计
- [ ] 1.2 编写 `docker-compose.yml`（nginx/api/worker/db）与 `.env.example`，运行 `docker compose config` 校验通过
- [ ] 1.3 配置 Nginx 托管前端静态文件并反代 `/api` 到 FastAPI，启动后 `curl -I http://localhost:8080/` 返回 200
- [ ] 1.4 实现 `/api/health` 并返回数据库连通状态，`curl /api/health` 返回 200
- [ ] 1.5 在 README 记录本地启动与服务器部署步骤，按文档命令可完整启动

## 2. 数据库与迁移

- [ ] 2.1 配置 SQLAlchemy 2.0 + Alembic，在空库执行 `alembic upgrade head` 成功
- [ ] 2.2 建立 `users`、`sessions` 表与约束，迁移成功并用 `\d` 核对字段
- [ ] 2.3 建立 `draws`、`draw_prizes` 表与唯一键、索引，迁移成功并核对约束
- [ ] 2.4 建立 `bets`、`sync_runs` 表与索引，迁移成功并核对约束
- [ ] 2.5 为数组长度、倍数范围、期号外键编写约束测试，`pytest` 通过

## 3. 认证与会话

- [ ] 3.1 实现注册接口（Argon2id、用户名唯一、密码长度），测试覆盖成功、重复、短密码
- [ ] 3.2 实现登录接口与统一 401 错误，测试覆盖正确与错误凭证
- [ ] 3.3 实现会话表、Cookie 下发与 `/auth/me`，测试验证 Cookie 属性和会话读取
- [ ] 3.4 实现登出与过期会话清理，测试验证登出后原 token 失效
- [ ] 3.5 实现登录/注册限流，测试在超过阈值后返回 429
- [ ] 3.6 实现管理员 CLI 重置密码，测试执行后旧密码失效、新密码可登录
- [ ] 3.7 在 README 补充认证接口与重置密码用法

## 4. 开奖数据同步

- [ ] 4.1 实现官方接口客户端（UA/Referer、超时、重试、分页），用固定响应夹具测试解析
- [ ] 4.2 实现全量回填命令，测试在夹具上写入期数正确且重复执行不新增
- [ ] 4.3 实现奖级明细解析与 `draw_prizes` 落库，测试覆盖奖池 <8 亿 / ≥8 亿两档金额
- [ ] 4.4 实现规则版本标注（`seven_tier` / `legacy`），测试覆盖 26013/26014 边界
- [ ] 4.5 实现 worker 定时任务（周一/三/六 21:35 Asia/Shanghai）与重试，测试成功、未发布重试、超限失败
- [ ] 4.6 实现 `sync_runs` 记录与失败留痕，测试失败后已有数据不变
- [ ] 4.7 实现手动 `sync` CLI，测试可补跑且幂等
- [ ] 4.8 用真实接口跑一次全量回填，核对总期数与官方 `total` 一致

## 5. 开奖查询

- [ ] 5.1 实现 `/draws/latest`、`/draws`（分页、倒序）、`/draws/{drawNo}`，测试覆盖分页边界与 404
- [ ] 5.2 单期详情返回奖级明细与规则版本，测试核对一条真实期次
- [ ] 5.3 为开奖查询补充 README 示例，验证文档中的请求可直接执行

## 6. 号码统计

- [ ] 6.1 实现前区/后区频率统计，测试用小型夹具核对次数与排序
- [ ] 6.2 实现遗漏期数统计，测试覆盖遗漏 0、遗漏 N、从未出现
- [ ] 6.3 实现三个时间窗与参数校验，测试覆盖 last100 边界和非法值
- [ ] 6.4 统计响应返回样本期数，测试核对期数与窗口一致
- [ ] 6.5 统计页加入“不构成预测依据”提示，手工验证文案可见

## 7. 投注记录与奖级核算

- [ ] 7.1 实现投注新增接口与输入校验（范围、去重、期号存在、倍数），测试覆盖各类非法输入
- [ ] 7.2 实现投入金额计算，测试覆盖普通/追加 × 倍数
- [ ] 7.3 实现七等奖制奖级判定，测试覆盖全部命中组合
- [ ] 7.4 实现历史期次投注拒绝（26014 期之前返回明确错误），测试覆盖 26013/26014 边界
- [ ] 7.5 实现奖金计算（固定奖取接口、追加 ×80%、乘倍数），测试覆盖一/二/固定奖与追加
- [ ] 7.6 实现待开奖状态与开奖后自动重算，测试录入未开奖期次显示待开奖、补数据后自动出结果
- [ ] 7.7 实现投注列表/修改/删除与用户隔离，测试跨用户访问返回 403/404
- [ ] 7.8 实现盈亏汇总接口，测试多期投入/中奖/净盈亏
- [ ] 7.9 在 README 记录投注与奖级规则说明

## 8. 前端

- [ ] 8.1 初始化 React + Vite + TS + Tailwind + Router + TanStack Query，`npm run build` 成功
- [ ] 8.2 实现登录/注册页与 `/auth/me` 会话探测，手工验证未登录跳转
- [ ] 8.3 实现首页（最新一期 + 最近若干期），手工核对与接口数据一致
- [ ] 8.4 实现历史列表与单期详情，手工验证分页、奖级明细与“历史规则”标注
- [ ] 8.5 实现号码统计页（频率条形图 + 遗漏 + 时间窗切换），手工核对与接口一致
- [ ] 8.6 实现投注录入页（号码选择、追加、倍数、金额预览），手工验证校验提示与 26014 前不可录入
- [ ] 8.7 实现我的投注页（中奖状态、奖级、奖金、盈亏汇总），手工核对
- [ ] 8.8 移动端响应式检查（375px / 768px / 1280px），手工验证无横向滚动
- [ ] 8.9 前端加入统一错误与 401 处理，手工验证会话过期跳登录

## 9. 集成、验证与部署

- [ ] 9.1 在 Docker Compose 环境端到端跑通注册→录入投注→同步开奖→查看中奖，记录一次完整操作

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
- Lines: 1-129
- SHA256: 84d8f13dcbb79632894f2ff794321a100c69616ce168acc72defafc7daa6713c

[TRUNCATED]

```md
# Spec Delta

## Purpose

记录用户按期录入的单式投注，在开奖后按七等奖制判定奖级与奖金，并汇总投入、中奖与盈亏。

## ADDED Requirements

### Requirement: 投注录入

用户 SHALL 能在 26014 期及以后的开奖期次上录入一注单式投注，包含前区 5 个不重复号码（01–35）、后区 2 个不重复号码（01–12）、是否追加和 2–99 的倍数。

#### Scenario: 合法录入

- **WHEN** 用户提交 26014 期及以后的合法期号、5 个前区号、2 个后区号和有效倍数
- **THEN** 系统保存该投注并返回计算后的投入金额

#### Scenario: 历史期次不支持核算

- **WHEN** 用户为 26014 期之前的期次录入投注
- **THEN** 系统拒绝保存并提示该期规则版本不支持自动核算

#### Scenario: 号码越界或重复

- **WHEN** 前区或后区号码越界或存在重复
- **THEN** 系统拒绝保存并返回校验错误

#### Scenario: 期号不存在

- **WHEN** 用户提交一个尚未同步的期号
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

### Requirement: 奖金计算

固定奖 SHALL 使用该期接口返回的单注奖金；一、二等奖使用接口返回的浮动奖金；追加投注仅在一、二等奖时加发基本奖金的 80%；最终奖金乘以倍数。

#### Scenario: 固定奖按当期金额

- **WHEN** 投注中得七等奖制下的三等奖且当期单注奖金为 5000 元
- **THEN** 单注奖金为 5000 元，再乘以倍数

#### Scenario: 追加一等奖

```

Full source: docs/openspec/changes/dlt-lottery-tracker/specs/bet-tracking/spec.md

## docs/openspec/changes/dlt-lottery-tracker/specs/draw-data/spec.md

- Source: docs/openspec/changes/dlt-lottery-tracker/specs/draw-data/spec.md
- Lines: 1-96
- SHA256: d9f97f3319df727e31aaae1526865ce47de8469c32731bfd60d81564009e7969

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

### Requirement: 规则版本标注

系统 SHALL 为 26014 期及以后的开奖标注“七等奖制”；26014 期之前的开奖标注为“历史规则”，仅用于展示，不参与投注核算。

#### Scenario: 七等奖制期次

- **WHEN** 查询 26014 期及之后的开奖
- **THEN** 该期标注为七等奖制

#### Scenario: 历史规则期次


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
