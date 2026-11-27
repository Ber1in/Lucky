---
change: dlt-lottery-tracker
design-doc: docs/openspec/changes/dlt-lottery-tracker/design.md
base-ref: a8d09f5f6acbcc4746599ef505f3ee7d3b813e04
archived-with: 2026-11-27-dlt-lottery-tracker
---

<!-- comet-task-authority: docs/openspec/changes/dlt-lottery-tracker/tasks.md -->

# 实施计划：dlt-lottery-tracker

执行策略：autonomous + TDD（每个实现任务先写失败测试，再实现到通过）+ standard 审查。
设计依据：`design.md`；需求依据：`specs/**/spec.md`。

## 实现约定

- 目录：`backend/`（FastAPI）、`frontend/`（React）、`deploy/`（Nginx、Compose 辅助文件）。
- 测试：pytest + FastAPI TestClient + SQLite 临时库；生产用 PostgreSQL。
- 号码存储：为同时兼容 PostgreSQL 与 SQLite 测试，`front_numbers`/`back_numbers` 用 JSON 数组（Postgres 侧为 JSONB），长度与范围由应用层校验；这是对设计文档中 `smallint[]` 的实现细节调整，不改变公开行为。
- 规则引擎：`backend/app/services/prize_rules.py` 只读映射，`seven_tier` 与 `legacy` 两种版本。
- 每个任务完成且测试通过后，用 `comet state task-complete` 勾选对应 ID。

## W1 骨架与运行环境

<!-- comet-task-ref:890f2e19-f0cd-4d29-ba89-f9c07458059c -->
- **1.1** 建立 `backend/app`、`frontend/`、`deploy/` 与根 README；验收：`find` 检查目录存在。
<!-- comet-task-ref:9497399c-06af-4829-8288-a29848fcb253 -->
- **1.2** 编写 `docker-compose.yml` 与 `.env.example`（nginx/api/worker/db）；验收：`docker compose config` 通过（无 Docker 时用 YAML 解析校验）。
<!-- comet-task-ref:9215d871-7922-4f82-a961-9806f9305310 -->
- **1.3** 编写 Nginx 配置：静态站 + `/api` 反代；验收：配置语法检查与本地启动后 `curl -I` 返回 200。
<!-- comet-task-ref:3290c330-e7de-4b01-b695-fcd89c3f9423 -->
- **1.4** 实现 `/api/health`；验收：TestClient 返回 200 且含 db 状态。
<!-- comet-task-ref:855a0a56-3e18-4b94-bed2-e07229bbc46b -->
- **1.5** README 写本地启动与服务器部署步骤；验收：命令逐条可执行。

## W2 数据库与迁移

<!-- comet-task-ref:bc5e6752-1111-43c1-8864-7fcb3a91ec34 -->
- **2.1** 配置 SQLAlchemy 2.0 + Alembic；验收：空库 `alembic upgrade head` 成功。
<!-- comet-task-ref:dee0d59d-c731-4dd3-9308-3057dbe6eb83 -->
- **2.2** `users`、`sessions` 表与约束；验收：迁移成功，测试可建表。
<!-- comet-task-ref:fb37259d-0f73-4e3a-9802-586e585d042d -->
- **2.3** `draws`、`draw_prizes` 表与唯一键、索引；验收：迁移成功，`draw_no` 唯一。
<!-- comet-task-ref:a54309ee-da03-4ab0-948a-befe9a9b79c7 -->
- **2.4** `bets`、`sync_runs` 表与索引；验收：迁移成功，外键与索引存在。
<!-- comet-task-ref:20075487-c180-452a-b5c0-de44264f03c1 -->
- **2.5** 约束测试（号码长度/范围、倍数、期号外键）；验收：`pytest` 通过。
<!-- comet-task-ref:358560fb-c2e4-436a-8559-335d22e86d70 -->
- **2.6** `bets.ticket_amount` 字段与迁移；验收：`alembic upgrade head` 成功。

## W3 认证与会话

<!-- comet-task-ref:aee49306-2568-4fad-9a23-c27cbfa9e244 -->
- **3.1** 注册接口（Argon2id、唯一用户名、密码 ≥8）；验收：成功/重复/短密码测试。
<!-- comet-task-ref:34ba9693-73a3-4e04-88e0-c5434c32a7e3 -->
- **3.2** 登录接口与统一 401；验收：正确/错误凭证测试。
<!-- comet-task-ref:6b3f5745-a46d-40f9-bf61-00b186039400 -->
- **3.3** 会话表、Cookie、`/auth/me`；验收：Cookie 属性与会话读取测试。
<!-- comet-task-ref:af64ff84-7f1a-4d2f-8e1d-21710710e108 -->
- **3.4** 登出与过期清理；验收：登出后 token 失效测试。
<!-- comet-task-ref:810f6daf-aaf0-458e-ad6f-b57780a00166 -->
- **3.5** 登录/注册限流；验收：超阈值返回 429。
<!-- comet-task-ref:918a84f5-2d0f-4797-89c5-e9f10a48f2b3 -->
- **3.6** 管理员 CLI 重置密码；验收：旧密码失效、新密码可登录。
<!-- comet-task-ref:1a8f05d4-75ff-4952-ade2-c02b8a6e0520 -->
- **3.7** README 补认证与重置说明；验收：文档命令可执行。

## W4 开奖数据同步

<!-- comet-task-ref:1377bd56-8934-44ff-83f2-73102a8e85b2 -->
- **4.1** 官方接口客户端（UA/Referer、超时、重试、分页）；验收：固定夹具解析测试。
<!-- comet-task-ref:b743a92c-9714-40bb-ba9e-36bc74f2f7f3 -->
- **4.2** 全量回填命令；验收：夹具回填期数正确、重复执行不新增。
<!-- comet-task-ref:aba7839c-da5f-4f04-81ad-59c69dadf1be -->
- **4.3** 奖级明细解析与落库；验收：<8 亿 / ≥8 亿两档金额测试。
<!-- comet-task-ref:e8109338-362c-4fa8-a648-ded4076b7744 -->
- **4.4** 规则版本标注；验收：26013/26014 边界测试。
<!-- comet-task-ref:82df54b7-d32c-43fe-b09b-3ef4c16cbce9 -->
- **4.5** worker 定时与重试；验收：成功、未发布重试、超限失败测试（注入时钟）。
<!-- comet-task-ref:56da49c3-75da-4293-9046-e60f83027594 -->
- **4.6** `sync_runs` 记录；验收：失败后已有数据不变。
<!-- comet-task-ref:db833885-bc09-42c6-85dd-3f6ac4b13de4 -->
- **4.7** 手动 `sync` CLI；验收：补跑幂等。
<!-- comet-task-ref:22d79edf-3964-4bcc-ba24-2b95622117df -->
- **4.8** 真实接口全量回填；验收：期数与官方 `total` 一致（网络不可用时记录并跳过）。

## W5 开奖查询

<!-- comet-task-ref:9ca0e984-c9f0-4103-99f0-19556da9ca6b -->
- **5.1** `/draws/latest`、`/draws`、`/draws/{drawNo}`；验收：分页边界与 404 测试。
<!-- comet-task-ref:505dd630-ffd0-44ac-a0ba-27345841d412 -->
- **5.2** 详情含奖级明细与规则版本；验收：真实期次夹具测试。
<!-- comet-task-ref:476f570d-9f5d-4058-9652-20508d88f463 -->
- **5.3** README API 示例；验收：示例可直接执行。
<!-- comet-task-ref:f2849707-9884-488f-9ebc-9e813e874be3 -->
- **5.4** `/api/draws/next` 与年末进位；验收：26014→26015、26156→27001、空表 404。

## W6 号码统计

<!-- comet-task-ref:1bde73a6-93d4-4d66-a572-0d9dc9b4b02e -->
- **6.1** 前区/后区频率；验收：夹具次数与排序测试。
<!-- comet-task-ref:6d639031-6146-434e-a763-2e49a8be4102 -->
- **6.2** 遗漏期数；验收：0 / N / 从未出现测试。
<!-- comet-task-ref:cab91f72-a671-4456-920e-510beec5a095 -->
- **6.3** 三个时间窗与校验；验收：last100 边界与非法值测试。
<!-- comet-task-ref:94e7f64f-1bb8-4625-a321-e72e3aa064b1 -->
- **6.4** 返回样本期数；验收：期数与窗口一致。
<!-- comet-task-ref:c03a4e40-041e-4ea5-8f6d-ea2d1c2d7d5b -->
- **6.5** 统计页随机性提示；验收：页面文案可见。

## W7 投注与奖级核算

<!-- comet-task-ref:889b1841-a85d-4dd7-b344-8d042d903f5c -->
- **7.1** 投注新增与校验；验收：非法输入测试。
<!-- comet-task-ref:36c6ffb9-4a8e-4969-bb3c-f3c5cb22721e -->
- **7.2** 投入金额；验收：普通/追加 × 倍数测试。
<!-- comet-task-ref:ecceac02-cff3-4711-a431-801b9a5cf499 -->
- **7.3** 七等奖制判定；验收：全部命中组合测试。
<!-- comet-task-ref:432f9987-9d7b-4f0b-a086-4f83f1322af4 -->
- **7.4** 历史期次拒绝；验收：26013/26014 边界测试。
<!-- comet-task-ref:14e3bcc4-ff21-4316-85da-3548ed0d503e -->
- **7.5** 奖金计算；验收：固定奖、追加、倍数测试。
<!-- comet-task-ref:57703242-6903-4217-a4c3-b88777692abd -->
- **7.6** 待开奖与自动重算；验收：录入未开奖 → 补数据后出结果。
<!-- comet-task-ref:27ce8c1a-b1a2-4341-a0fe-5ffa222f6d11 -->
- **7.7** 列表/修改/删除与隔离；验收：跨用户 403/404。
<!-- comet-task-ref:8932ea14-5951-49d0-a0ad-6774f03a4e45 -->
- **7.8** 盈亏汇总；验收：多期投入/中奖/净盈亏测试。
<!-- comet-task-ref:acefa2c0-8f2a-42a9-a6f0-24155816075e -->
- **7.9** README 规则说明；验收：文档可读且与实现一致。
<!-- comet-task-ref:004da76c-6085-492d-920c-f8009e1135e7 -->
- **7.10** 派奖期奖金加总（整张票 ≥18 元）；验收：26066 夹具与门槛测试。

## W8 前端

<!-- comet-task-ref:5b04458c-3eb1-4722-8208-9af90868f068 -->
- **8.1** 初始化 React + Vite + TS + Tailwind + Router + Query；验收：`npm run build`。
<!-- comet-task-ref:5343658f-747d-4602-b93d-2823cfd2f370 -->
- **8.2** 登录/注册页与会话探测；验收：未登录跳转。
<!-- comet-task-ref:83438ae8-cbe2-4788-995d-b4b0d8196337 -->
- **8.3** 首页；验收：与接口数据一致。
<!-- comet-task-ref:ad6a8b46-60da-4bef-8af7-53795946e07f -->
- **8.4** 历史列表与详情；验收：分页、奖级、`legacy` 标注。
<!-- comet-task-ref:18e597d7-c1e7-43fe-8a94-c935cac16613 -->
- **8.5** 号码统计页；验收：频率/遗漏/时间窗与接口一致。
<!-- comet-task-ref:8cbca651-6dfc-4d0d-bb8d-a1c65f33b743 -->
- **8.6** 投注录入页；验收：校验与 26014 前不可录入。
<!-- comet-task-ref:72956bb9-4a30-4ff1-9ab6-852fe624ca02 -->
- **8.7** 我的投注页；验收：中奖状态、奖级、奖金、盈亏。
<!-- comet-task-ref:4569fc19-a404-49d6-b810-901d673682df -->
- **8.8** 响应式检查；验收：375/768/1280 无横向滚动。
<!-- comet-task-ref:80bac14d-fbd3-45c4-8d4d-85d04dcbf838 -->
- **8.9** 统一错误与 401；验收：会话过期跳登录。
<!-- comet-task-ref:33dcaf6a-e51a-4fd8-9934-f3c4207fcb5b -->
- **8.10** 期号留空默认下一期；验收：表单留空可提交为 26015，修改/删除可用。

## W9 集成、验证与部署

<!-- comet-task-ref:1b4b55bc-f1dc-4a2e-8108-90f2b3bf1ea3 -->
- **9.1** Compose 端到端；验收：注册→录入→同步→查看中奖。
<!-- comet-task-ref:c697aee3-082b-4d86-a2d0-85e5d98efd76 -->
- **9.2** worker 模拟开奖日；验收：期号递增。
<!-- comet-task-ref:9cb71ba1-5f94-48ae-833c-2c3464c01ea7 -->
- **9.3** 每日备份与恢复演练；验收：恢复后数据完整。
<!-- comet-task-ref:ea9fa38a-a96e-4c76-a21e-c6f5a7262f20 -->
- **9.4** 部署文档；验收：干净环境按文档走通。
<!-- comet-task-ref:7ef76abd-3144-4740-8587-64985f0dd460 -->
- **9.5** 全量 `pytest` + `npm run build`；验收：全部通过。

## W10 仓库整理

<!-- comet-task-ref:7ec44fa5-e2fe-4372-a1e2-7be652f52339 -->
- **10.1** 代码注释统一英文；验收：扫描无中文注释，测试与构建通过。

## 风险与回退

- 无 Docker/Postgres 的环境用 SQLite + TestClient 完成自动化验证；生产用 Compose 与 PostgreSQL。
- 官方接口不可达时，用夹具完成同步测试，真实回填作为可选验证步骤。
- 每个工作包独立可验收；失败时只回退该包内的改动。
