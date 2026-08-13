# Fantasy NBA System Agent Guide

本文件是 `D:\projects\fantasy_nba_system` 的项目级工作规范。它约束所有代码、文档、数据、部署与 Git 操作。先读本文件和 `MEMORY.md`，再开始改动；当两者与代码或外部服务状态不一致时，以当前代码和已验证的外部状态为准，并同步修正文档。

## 1. 项目目标与范围

这是一个 NBA 单比赛日五人阵容工具，不是完整的 Yahoo Fantasy 联盟复刻。已登录用户可以：

- 浏览下一个可用比赛日的球员池。
- 为 PG、SG、SF、PF、C 各选一名球员。
- 在 `$125` 工资帽内保存、编辑或删除阵容。
- 查看当前阵容与按日期筛选的历史阵容。
- 以中文或英文搜索球员。
- 从首页进入范特西阵容和预测首发两个模块。

不要把尚未实现的产品能力说成已存在。`/predicted-starters` 目前是登录保护的页面和空状态，尚未接入预测首发、伤病、盘口或其他赛前情报数据。

## 2. 架构与目录

### 技术栈

- Next.js App Router + React + TypeScript strict mode。
- PostgreSQL（Neon）+ Prisma；旧有业务表仍有一部分通过 raw SQL 访问。
- Vercel 部署；Cron endpoint 以 `CRON_SECRET` 鉴权。
- Vitest 测试。
- Lucide React 图标；不手写重复 SVG 图标。

### 主要目录

| 路径 | 职责 | 修改注意事项 |
| --- | --- | --- |
| `src/app/` | 页面、layout、全局样式、API routes | 遵循 App Router；页面需处理登录态与空状态 |
| `src/components/` | 可复用前端组件 | UI 行为改动需在真实浏览器验证桌面和手机视图 |
| `src/lib/` | 共享业务规则和服务 | 优先把规则写在这里，避免页面/API 各自复制 |
| `src/app/api/nba/next-player-pool/route.ts` | 比赛日、球员池、显示数据、身价、锁定状态 | 这是高风险共享接口，变更时检查 fallback 与所有返回字段 |
| `src/app/api/lineups/route.ts` | 当前用户的阵容读写和服务端校验 | 所有前端限制都必须在这里再次校验 |
| `src/app/api/cron/` | 比赛与球员平均数据同步入口 | 只能由授权 Cron 或明确批准的手动操作调用 |
| `src/lib/player-pricing.ts` | 梦幻分、稳定化样本、身价边界 | 球员池和提交阵容必须继续共用此模块 |
| `src/lib/game-window.ts` | 比赛日选择、开赛判断、球队锁定 | 锁定逻辑不能散落到 UI 中 |
| `src/lib/*translations*.ts` | 球员和球队中文展示名 | 中文名仅展示和搜索，不能作为数据身份 |
| `scripts/` | 手动同步脚本 | 会写数据库，运行前必须获得明确批准 |
| `prisma/` | Prisma schema 与 migrations | migration 是不可变历史，不得回改已执行文件 |
| `vercel.json` | Cron 定义 | 定义存在不等于线上已启用；必须同时检查 Vercel 控制台 |
| `MEMORY.md` | 已完成工作、运行状态和待办事项 | 新完成的重大能力或运维变更要同步更新 |

## 3. 领域规则与不可破坏的不变量

### 身份、语言和位置

- 英文名、NBA player ID 或数据库 ID 是球员身份和关联键；中文名仅作展示与搜索。
- 翻译需通过 `normalizeTranslationName` 兼容重音、点、撇号、连字符与后缀差异；不要新增第二套规范化逻辑。
- 球队 tricode 是业务键，中文队名只是 UI 显示。
- 位置与可选槽位优先复用 `player-position-overrides`；未经验证不要凭显示名称硬编码新位置。
- 同一球员不能在同一阵容的两个槽位出现。

### 比赛日、锁定和历史阵容

- NBA 比赛日选择使用美东日期；业务保存、展示和比较的时间语意使用北京时区 `Asia/Shanghai`。
- `status === 1` 的比赛明确表示未开赛；`status === 2`、`status === 3` 或开赛时间已过表示已开赛。
- 只有已开赛比赛的球队会锁定。其他球队未开赛时，用户仍可编辑或替换其球员。
- 一份阵容只有在该比赛日全部比赛开始后才属于历史阵容；不能因为最早一场开始就把整份阵容归档。
- 前端禁用按钮只是体验层；`POST` 和 `PUT /api/lineups` 必须始终重新执行锁定验证。
- 编辑既有阵容时，已经锁定且未被替换的原球员可以保留；不能因为锁定而使用户无法保存其他未锁定槽位的改动。

### 工资帽和身价

- 阵容固定为 PG、SG、SF、PF、C 五人，工资帽固定为 `$125`。
- 球员身价边界为 `$10` 到 `$60`，由 `MIN_PLAYER_SALARY` 和 `MAX_PLAYER_SALARY` 定义。
- 身价只通过 `playerSalary()` 计算；不要在 player-pool API、lineups API、组件或脚本内复制公式。
- 现行梦幻分使用得分、投篮效率、篮板、助攻、抢断、盖帽和失误。更改任一权重必须同时更新测试、产品说明和定价合理性验证。
- 新赛季的当季数据按 `min(gamesPlayed / 20, 1)` 渐进接管上一季数据；无上季数据的新球员使用 15 分 baseline。不要为了少数早期比赛取消这层稳定机制。
- 显示统计可优先使用当季数据；定价统计必须遵循 `selectPricingStats()` 和稳定化逻辑，避免显示与价格不一致。

### 阵容保存和历史数据

- 保存阵容时，服务端重新计算薪资、梦幻分和工资帽，不信任浏览器传入的 `salary` 或总计。
- 已保存阵容保留提交时的球员与统计快照，历史阵容不能被后续球员资料刷新破坏。
- 历史日期来自已保存阵容的比赛日；不要用浏览器当前日期推断历史归属。
- 提交时间和比赛日展示必须避免把本地时区或 UTC 再次转换造成日期偏移。

## 4. 数据来源、同步和运维

### 外部数据处理

- 比赛日和对阵主要来自 NBA.com games 页面；球员数据优先使用 NBA 官方资料。
- 上游不可用时可走现有 player index、已有 `PlayerAverageStats` 或 Basketball Reference fallback；必须在 API/UI 中诚实标明旧数据或不可用状态，不能伪装成实时数据。
- 请求外部数据时保留现有 timeout、headers、错误处理和数据去重逻辑。先修共享 fallback，再修单一页面症状。
- NBA 上游曾返回 `502`。网络失败时不要覆盖已有可用数据，也不要把一次采样失败视为球员不存在。

### Cron 与生产状态

- `sync-games` 和 `sync-player-average-stats` 的端点要求 `CRON_SECRET`；未通过 `verifyCronRequest` 不得执行。
- `sync-games` 需要写 `CronExecution` 成功或失败记录，作为同步健康检查的权威数据面。
- `vercel.json` 当前定义比赛同步 `* * * * *`、平均数据同步 `30 16 * * *`。这只是代码配置；线上状态必须在 Vercel Cron Jobs 页面确认。
- 截至 2026-08-01，Vercel Cron Jobs 因季外而被停用；Neon production compute 配置为 5 分钟闲置后自动休眠。恢复赛季前需重新验证，不得凭本文直接操作。
- 恢复顺序：确认赛程和环境变量 → 以批准方式手动验证两条同步 → 查看 `CronExecution` 与 `Game` 数据新鲜度 → 最后启用 Vercel Cron Jobs。

### Neon 和数据库

- `DATABASE_URL` 只能从本地安全环境或已配置平台读取，绝不输出、写入文档或提交。
- 数据库业务时间使用 `now() AT TIME ZONE 'Asia/Shanghai'` 等明确语意；不要让 UTC 默认值混入面向用户的时间字段。
- Prisma schema 变更必须包含新 migration，并验证 migration 可应用。不要修改已执行 migration、手动篡改生产 schema 或混用不一致的字段名。
- raw SQL 涉及大小写表名时必须正确引用，例如 `"CronExecution"`、`"Game"`。尽量用 Prisma API，保留 raw SQL 时使用参数化值。
- 任何生产写入、迁移、同步、清理或回填，都要先获得用户的明确批准；只读诊断不等于允许写入。

## 5. 代码、UI 和文档规范

### 代码设计

- 使用 TypeScript，不使用 `any` 绕过类型错误；外部输入用窄类型、默认值和明确校验处理。
- 复用 `@/` alias 和现有模块。新增业务规则前先搜索是否已有共享函数。
- 页面负责呈现和交互，API route 负责鉴权、校验和响应，`src/lib/` 负责可复用规则和数据访问。
- 只增加完成当前需求所需的最小变更。不要为假设的未来需求引入新框架、服务、状态管理、抽象层或依赖。
- 修复 bug 时先找所有调用方与共享根因；不要只给截图中的单一路径加补丁。
- 非平凡的分支、循环、解析、金额、权限或时间逻辑至少增加一个能失败的 Vitest 测试；简单文案和样式改动不需要人为制造测试。

### UI 与可访问性

- 沿用当前深色球场/武侠视觉语言、现有间距和色彩；不要把普通页面区块堆成嵌套卡片。
- 优先用 lucide 图标和原生控件。日期选择使用原生 `<input type="date">`，不要为此新增日期组件库。
- 所有交互应有 loading、空、错误、禁用和成功状态。错误信息要说明用户下一步，而不是只显示技术异常。
- 手机端和桌面端都要检查文本换行、固定底部操作栏、选择列表和日期控件；不得只在一个尺寸下验证。
- 图标按钮应有 `aria-label` 或可理解的可见文字；模态框应处理焦点、关闭和键盘语义。

### 文档

- `README.md` 记录本地运行、环境变量和部署事实；功能或运维变化导致不一致时一并更新。
- `MEMORY.md` 记录已验证的项目历史、当前运行状态、决定与待办；不要把猜测、密钥或瞬时日志写进去。
- 文档中的命令、路径、接口和计划必须可在当前仓库验证。中文 Markdown 文件使用 UTF-8 读取和校验。
- 日志、缓存、下载、临时文件和大型中间文件优先放在 D 盘；不要将生成物提交到仓库。

## 6. 本地开发、测试与验证

### 常用命令

在仓库根目录运行：

```powershell
pnpm install
pnpm prisma:generate
pnpm typecheck
pnpm exec vitest run
pnpm build
```

本地启动：

```powershell
.\run-dev.cmd
```

手动数据同步，仅在获得批准且环境变量正确时执行：

```powershell
pnpm games:sync
pnpm player-stats:sync
```

Windows 环境中不假设 `node`、`pnpm` 或 shell profile 一定可用。若命令失败，先检查项目已有的 `run-dev.cmd`、bundled runtime 或现有启动方式，不要未经批准安装全局工具。

### 按风险选择验证

| 改动范围 | 至少验证 |
| --- | --- |
| 文档 | UTF-8 读取、引用命令/路径存在、`git diff --check` |
| 纯样式或文案 | `pnpm typecheck`，并在真实浏览器检查改动页面的桌面与手机视图 |
| 共享前端组件 | `pnpm typecheck`、相关 Vitest、浏览器验证使用该组件的页面 |
| 定价、比赛日、锁定、时间 | `pnpm typecheck`、相关 Vitest、边界案例和 player-pool/lineups 的前后端实际流程 |
| API、认证或数据库读写 | `pnpm typecheck`、相关 Vitest、已登录 API 流程和错误路径；生产写入仍需明确批准 |
| Prisma migration | client 生成、migration 验证、受影响查询验证；禁止把未经验证 migration 直接部署到生产 |
| Cron 或部署 | endpoint 授权、`CronExecution`/数据结果、Vercel 控制台状态；不得只看代码配置 |

提交前的最低检查：

```powershell
git status --short
git diff --check
pnpm typecheck
pnpm exec vitest run
pnpm build
```

若本次改动会改变用户可见流程，除了命令检查，还必须在实际应用中验证相关前端和后端路径。不得把“build 成功”描述成“功能已经验证”。

## 7. Git、GitHub 与交付

- 修改现有项目之前，先执行只读检查确认本地分支与 `origin/master` 同步；若本地已有项目改动尚未上传，先仅提交本次已完成且可验证的改动，再继续下一次修改。
- GitHub remote 必须存在且指向本项目；若未配置对应 GitHub 仓库，应先告知用户处理，不要猜测仓库或创建陌生 remote。
- 不要暂存与本次任务无关的文件，特别是用户的导出文件、`missing-player-chinese-names.xlsx`、环境文件、缓存和构建产物。
- 提交信息用动词开头，准确描述结果，例如 `Fix lineup locking` 或 `Add starter data source`。
- 推送前先完成与风险相称的验证，说明实际通过的检查和未能执行的检查。用户要求推送时才提交和推送；未要求时保留改动并报告状态。
- 不得使用 `git reset --hard`、`git checkout --`、强制推送、重写共享分支历史，或回滚不属于本次任务的用户改动。

## 8. 绝对不能做的事

- 不得提交、打印、复制到日志或发送 `.env*`、`DATABASE_URL`、`CRON_SECRET`、密码、token、cookie、完整连接字符串或用户个人数据。
- 未经用户明确批准，不得执行生产数据库写入、迁移、清空、删除、回填、同步，或执行会改变线上数据的脚本。
- 不得删除 Neon 项目、数据库、branch、compute，或删除 Vercel 项目、部署、域名、环境变量。
- 未经明确要求，不得启用、停用、修改或手动触发 Vercel Cron；不得触发生产部署。
- 不得绕过登录、session、阵容锁定、工资帽、比赛时间、球员唯一性或服务器端验证。
- 不得把中文展示名当作唯一身份，或因翻译变化创建重复球员和重复阵容记录。
- 不得用新赛季少量比赛直接替代稳定化定价逻辑，或在未同步两条价格路径的情况下变更价格范围/公式。
- 不得把上游 fallback、旧赛季数据、预测首发或非官方消息描述成实时数据、官方确认或最终结果。
- 不得改动、删除、提交或覆盖用户已有的未跟踪文件和无关改动。
- 不得把临时文件默认写到 C 盘；当前沙盒无法写 D 盘时，必须先说明并请求用户授权或指定路径。
