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

## 9. 集成、验证与部署

- [x] 9.1 在本地等价环境（uvicorn + Vite + SQLite）跑通注册→录入投注→查看中奖；Compose 环境待服务器验证 <!-- comet-task:1b4b55bc-f1dc-4a2e-8108-90f2b3bf1ea3 -->
- [x] 9.2 用真实接口回填 2953 期并验证 `sync_latest` 无新期返回 `no_update`、有新期时写入并核算 <!-- comet-task:c697aee3-082b-4d86-a2d0-85e5d98efd76 -->
- [x] 9.3 提供 `deploy/backup.sh`；本机用 SQLite 文件复制做等价恢复验证，`pg_dump` 待服务器演练 <!-- comet-task:9cb71ba1-5f94-48ae-833c-2c3464c01ea7 -->
- [x] 9.4 编写服务器部署文档（Docker 安装、.env、迁移、启动、备份）；干净服务器走通待部署时验证 <!-- comet-task:ea9fa38a-a96e-4c76-a21e-c6f5a7262f20 -->
- [x] 9.5 全量运行 `pytest` 与 `npm run build`，确认全部通过 <!-- comet-task:7ef76abd-3144-4740-8587-64985f0dd460 -->

## 10. 仓库整理

- [x] 10.1 将代码注释统一为英文，扫描确认代码中无中文注释，测试与构建通过 <!-- comet-task:7ec44fa5-e2fe-4372-a1e2-7be652f52339 -->

## Workflow follow-up

- 将目录改名为 `lucky`，配置 remote `git@github.com:Ber1in/Lucky.git`，以 `ber1in <1652124020@qq.com>` 提交并推送。

- 完成 Verify 阶段的集成审查后归档 change。
- 归档后确认 `docs/openspec/specs` 下生成四个能力规格。
