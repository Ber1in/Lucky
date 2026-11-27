# 大乐透数据站

自用的大乐透数据站：自动同步每期开奖、统计号码分布、记录个人投注并核算奖级与盈亏。前后端分离，单机 Docker Compose 部署。

## 功能

- 开奖数据：官方接口全量回填（2007 年至今），每周一、三、六 21:35 自动增量同步，失败重试、幂等去重。
- 开奖展示：最新一期、历史列表、单期详情与奖级明细。
- 号码统计：前区 01–35、后区 01–12 的出现频率与遗漏期数，支持近 1 个月 / 近 3 个月 / 近 1 年 / 近 3 年；默认只统计七等奖制期次，可选包含九等奖制、六等奖制。
- 用户体系：用户名 + 密码注册登录，会话 Cookie，多用户数据隔离。
- 投注记录：单式 + 追加 + 倍数（1–99），前区点选 5 个、后区点选 2 个；期号留空时默认使用下一期（尚未开奖），记录可修改和删除。
- 奖级核算：按七等奖制判定奖级与奖金，追加仅一/二等奖 ×80%，汇总投入、中奖与盈亏。

## 技术栈

- 前端：React 18 + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query
- 后端：FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2
- 数据库：PostgreSQL 16（测试使用 SQLite）
- 部署：Nginx + Docker Compose

## 目录

```text
backend/        FastAPI 服务、模型、同步 worker、CLI、测试、Alembic
frontend/       React 应用
deploy/         Nginx 配置、Dockerfile、备份脚本
docs/           OpenSpec 变更与设计文档
docker-compose.yml
```

## 本地开发

### 后端

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=sqlite:///./app.db
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

首次需要回填开奖数据（需要能访问体彩官方接口）：

```bash
cd backend
python -m app.cli backfill
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

Vite 已配置 `/api` 代理到 `http://localhost:8000`，访问 `http://localhost:5173`。

## 测试与构建

```bash
cd backend && PYTHONPATH=. pytest -q
cd frontend && npm run build
```

## 运维命令

```bash
# 在 backend 目录、配置好 DATABASE_URL 后执行
python -m app.cli backfill          # 全量回填
python -m app.cli sync              # 增量同步最新一期（带重试）
python -m app.cli reset-password <用户名> <新密码>
```

## Docker 部署

在服务器上：

```bash
cp .env.example .env
# 修改 .env 中的 POSTGRES_PASSWORD、DATABASE_URL、SECRET_KEY
docker compose up -d --build
```

访问 `http://<服务器IP>:8080`。

- `api` 启动时自动执行 `alembic upgrade head`。
- `worker` 启动时若开奖表为空会自动全量回填，之后在开奖日 21:35 增量同步。
- 数据卷：`pgdata`。

## API 示例

```bash
curl http://<服务器IP>:8080/api/draws/latest
curl "http://<服务器IP>:8080/api/draws?page=1&pageSize=20"
curl "http://<服务器IP>:8080/api/insights/numbers?window=last100"
```

需要登录的接口请带上会话 Cookie：

```bash
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"username":"demo","password":"password123"}' \
  http://<服务器IP>:8080/api/auth/login
curl -b cookies.txt http://<服务器IP>:8080/api/bets/summary
```

## 备份与恢复

```bash
./deploy/backup.sh                          # 导出到 ./backups/dlt-<时间>.sql
# 恢复（账号/库名与 .env 保持一致）
docker compose exec -T db psql -U "${POSTGRES_USER:-dlt}" -d "${POSTGRES_DB:-dlt}" \
  < backups/dlt-<时间>.sql
```

建议用宿主机 cron 每天执行一次备份。

## 数据与规则说明

- 数据源：中国体育彩票官方接口 `getHistoryPageListV1`，服务端抓取并附带浏览器 UA 与 Referer 以通过 WAF。
- 开奖时间：每周一、三、六 21:25（北京时间），结果约 21:35 可查。
- 奖级：自 26014 期（2026-02-02）起为七等奖制。26014 期之前只展示开奖号码与接口返回的奖级明细，不接受投注录入。
- 固定奖金额随奖池阈值浮动（<8 亿 / ≥8 亿），一律取接口返回值，不硬编码。
- 追加只加一、二等奖，金额为基本单注奖金的 80%；倍数 1–99。
- 派奖期：官方奖级列表会额外返回「X等奖派奖」条目。录入投注时可填写“整张票金额”，单票单期金额 ≥18 元时计入派奖；不填则按本注金额判断。若一张票包含多注，请把整张票金额填在每一注上。

## 安全说明

当前按“单机 + IP 访问”部署，暂未启用 HTTPS。已采取 Argon2id 密码哈希、登录/注册限流、HttpOnly + SameSite Cookie、统一认证错误。开放注册环境下建议后续补域名与 TLS，再考虑邀请码或邮箱验证。
