# 验证报告：dlt-lottery-tracker

- 日期：2026-11-27
- 验证模式：full
- 变更：`docs/openspec/changes/dlt-lottery-tracker`
- 结论：**PASS**

## 规模

- 任务：61 / 61
- 能力：4 个（`draw-data`、`number-insights`、`bet-tracking`、`user-auth`）
- 需求：26 个；场景：58 个
- 变更文件：80+

## 检查结果

| 检查项 | 结果 | 证据 |
|---|---|---|
| 任务完成 | PASS | `tasks.md` 61/61 |
| 后端测试 | PASS | `PYTHONPATH=backend python3 -m pytest backend -q` → 91 passed |
| 前端构建 | PASS | `npm --prefix frontend run build` → 成功 |
| 数据库迁移 | PASS | 空库 `alembic upgrade head` 成功，含 `bets.ticket_amount` |
| 真实数据回填 | PASS | 官方接口回填 2953 期（07001–26135），重复回填不新增 |
| 增量同步语义 | PASS | 无新期返回 `no_update`；有新版写入并核算；缺口自动补齐 |
| 派奖金额 | PASS | 26066：三等奖 6666 + 派奖 3333 = 9999；18 元门槛生效 |
| 页面端到端 | PASS | Playwright：注册、投注、中奖展示、统计提示、375/768/1280 无横向滚动、登出保护 |
| 安全 | PASS | Argon2id、会话吊销、登录 + IP 限流、统一 401、HttpOnly/SameSite |
| 独立审查 | PASS | 三轮审查；CRITICAL/IMPORTANT 已修复并复核 |

## 需求与场景覆盖

| 能力 | 需求 | 场景 |
|---|---|---|
| draw-data | 7 | 16 |
| number-insights | 5 | 9 |
| bet-tracking | 8 | 22 |
| user-auth | 6 | 11 |

关键验收点均有实现与测试：

1. 首次全量回填 2953 期，重复回填幂等。
2. 开奖日 21:35 同步；官方未发布时重试，最终记录 `no_update`；停机跨期可自动补齐。
3. 规则版本：26013 及以前为 `legacy`，26014 起为 `seven_tier`。
4. 26014 期前拒绝录入投注；未来期次可预录并显示“待开奖”，开奖后自动核算。
5. 七等奖制 13 种命中组合映射正确；追加仅一/二等奖 ×1.8；倍数最终相乘。
6. 派奖期按整张票单期金额 ≥18 元加总派奖；改倍数或清空整票金额后重新判断。
7. 用户隔离：跨用户读取、修改、删除返回 404。
8. 登出、会话过期、管理员重置密码后旧会话立即失效。
9. 数据库不可用时 `/api/health` 返回 503。
10. 期号留空时默认下一期：26014 → 26015，26156 → 27001；记录可修改、删除。

## 审查发现与修复

| # | 级别 | 问题 | 修复 |
|---|---|---|---|
| 1 | CRITICAL | 派奖期奖金漏算 | 加总 `{奖级}派奖`；新增 `ticket_amount` 与 18 元门槛 |
| 2 | IMPORTANT | 登录限流可按用户名绕过、限流表增长 | 增加 IP 总桶、失败才计数、`blocked()` 只读、容量上限淘汰 |
| 3 | IMPORTANT | 重置密码后旧会话仍有效 | 重置时吊销该用户全部会话 |
| 4 | IMPORTANT | 增量同步只取 10 条、无更新不刷新 | pageSize 100、同步前补齐、`no_update` 刷新最新一期 |
| 5 | IMPORTANT | 回填未完成记成功、首次失败不补历史 | 比对官方 `total`、同步前 `backfill_newer`、记录 `SyncRun` |
| 6 | IMPORTANT | 投注与同步竞态导致永久待开奖 | 提交后二次评估 + 同步结束评估 pending |
| 7 | IMPORTANT | 改倍数后派奖门槛不重算 | 未填写时存 NULL，核算回退 `cost`；PATCH 支持显式清空 |
| 8 | IMPORTANT | worker 预补齐导致 `no_update` 空转 | 移除 worker 预调用，统一由 `sync_latest.fill_gaps` 处理 |
| 9 | IMPORTANT | 测试与任务声明不一致 | 补齐派奖/门槛/8 亿上浮/last1y/过期/503/注册与 IP 限流/限流容量/并发测试，共 91 项 |
| 10 | IMPORTANT | 备份脚本不可执行、恢复失败 | `chmod +x`、`pg_dump --clean --if-exists`、README 更新 |
| 11 | IMPORTANT | 限流器并发下无锁删除字典会抛异常 | `SlidingWindowLimiter` 全操作加 `threading.Lock`，补 8 线程并发测试 |

## 本轮新增需求

- 投注期号留空时默认下一期：26014 → 26015，26156 → 27001；未来期次显示“待开奖”，开奖后自动核算；记录可修改、删除。
- 代码注释统一为英文，文档保持中文；commit message 使用英文。

## 已知限制

- 本机无 Docker，Compose 与 `pg_dump` 恢复未实际执行；已用 uvicorn + Vite + SQLite 做等价端到端验证。服务器首次部署时需执行一次 `docker compose up -d --build` 并演练备份恢复。
- 派奖按“整张票单期金额”判断；一张票包含多注时，需在每一注填写同一整票金额。
- 限流为单进程内存实现；当前单 worker 部署足够，多 worker 需外部存储。
- 26014 期前的历史期次只展示，不支持投注自动核算（本期明确范围）。

## 最终评估

All checks passed. Ready for archive.
