# Fantasy NBA System Agent Guide

## 项目背景与目录

本项目是一个 NBA 范特西阵容网站。核心功能包括用户登录、球员池与身价、阵容提交和历史阵容、比赛数据同步，以及预测首发入口。

- `src/app/`：Next.js App Router 页面与 API 路由。
- `src/components/`：可复用界面组件及其测试。
- `src/lib/`：认证、比赛窗口、球员定价、名称翻译和数据同步等业务逻辑。
- `scripts/`：手动同步比赛和球员场均数据的脚本。
- `prisma/`：PostgreSQL 数据模型与迁移。
- `vercel.json`：Vercel Cron 配置。
- `run-dev.cmd`：Windows 本地启动入口。

技术栈为 Next.js、React、TypeScript、Prisma、PostgreSQL（Neon）和 Vitest，生产环境部署在 Vercel。数据库业务时间统一使用北京时间（`Asia/Shanghai`）。

## 代码与文档规范

- 使用 TypeScript 严格模式，并优先复用 `src/lib/` 中已有逻辑；不要为单一用途新增抽象或依赖。
- 使用 `@/` 导入 `src/` 下模块，保持现有 App Router、API Route 和组件写法。
- 业务规则放在共享模块中，页面和 API 只负责输入、权限、调用与输出。
- 金额、比赛状态、阵容锁定和时间判断必须有明确边界；非平凡逻辑至少补一个可运行的 Vitest 测试。
- 中文球员名仅用于展示；球员关联、查询和更新继续使用稳定的英文名、NBA ID 或数据库 ID。
- 数据库结构变更必须新增 Prisma migration，不得修改已经执行过的 migration。
- 文档必须与实际脚本、环境变量和部署配置一致；命令、路径和变量名使用反引号标记。
- 日志、缓存、临时文件和大型中间文件优先写入 D 盘，不要提交生成物。

## 测试和交付命令

在仓库根目录执行：

```powershell
pnpm install
pnpm prisma:generate
pnpm typecheck
pnpm exec vitest run
pnpm build
```

本地运行：

```powershell
.\run-dev.cmd
```

仅在已配置正确环境变量且明确需要时运行数据同步：

```powershell
pnpm games:sync
pnpm player-stats:sync
```

交付前执行 `git status --short` 和 `git diff --check`，确认改动范围、测试结果和未跟踪文件。提交或推送前先确认本地分支与 GitHub 上游同步，并只暂存本次任务涉及的文件。

## 绝对不能做的事

- 不得提交或输出 `.env*`、`DATABASE_URL`、`CRON_SECRET`、密码、令牌或连接字符串。
- 未经用户明确批准，不得写入、迁移、清空或删除生产数据库，不得手动运行生产数据同步。
- 不得删除 Neon 项目、数据库、branch、compute，或删除 Vercel 项目和域名。
- 未经明确要求，不得启用、停用或修改 Vercel Cron，也不得触发生产部署。
- 不得绕过认证、阵容锁定、工资帽或比赛时间规则。
- 不得用中文展示名作为球员唯一标识，也不得因翻译变化创建重复球员。
- 不得修改或删除用户已有但不属于本次任务的改动、未跟踪文件或数据导出。
- 不得使用 `git reset --hard`、强制推送或重写共享分支历史。
- 不得为了未来可能的需求引入新框架、服务、抽象层或依赖。
