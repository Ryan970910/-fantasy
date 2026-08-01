# Fantasy NBA System Memory

最後更新：2026-07-29。本文根據 Git 歷史（截至 `14eee61`）、目前程式碼與 2026-07 的已驗證操作整理。外部服務設定、NBA 資料與賽程會變動，使用前必須重新確認。

## 1. 專案定位與目前狀態

這是一個以單日五人陣容為核心的 NBA 範特西網站，而不是完整的 Yahoo 聯盟模擬器。使用者登入後，可以按比賽日挑選 PG、SG、SF、PF、C 五個位置的球員，在 `$125` 工資帽內提交、修改或刪除陣容；系統會依開賽狀態鎖定已開賽球隊的球員，並保留歷史陣容。

目前生產環境的季外狀態：

- Vercel 專案為 `fantasy`，team 為 `ryannbafantasy`。
- Vercel Cron Jobs 已在控制台停用，保留設定但不會執行；恢復賽季時需手動重新啟用。
- Neon 專案為 `nba-fantasy-game`（project id `lively-breeze-00301169`）。production compute 設為閒置 5 分鐘後 Scale to zero，連線時會自動喚醒。
- 網站仍可開啟；任何需要讀取資料庫的請求仍可能喚醒 Neon。

## 2. 架構設計

### 技術與部署

- 前端與後端：Next.js App Router、React、TypeScript strict mode。
- 資料庫：PostgreSQL（Neon），透過 Prisma 與少量既有 raw SQL 存取。
- 部署與排程：Vercel；Cron endpoint 以 `CRON_SECRET` 驗證。
- 測試：Vitest；現有核心測試覆蓋 `player-pricing`、`game-window` 與 `lineup-picker`。
- 時間語意：資料庫業務時間與使用者面向的比賽時間採北京時間（`Asia/Shanghai`）；NBA 比賽日選擇則依美東日期處理。

### 目錄與責任

| 路徑 | 責任 |
| --- | --- |
| `src/app/` | 頁面、版面、全域樣式與 API routes |
| `src/components/` | `LineupPicker`、頂部導覽、即時比賽元件與前端測試 |
| `src/lib/` | 認證、session、價格、比賽視窗、名稱翻譯、資料同步與 Prisma client |
| `src/app/api/nba/next-player-pool/route.ts` | 比賽日、球員池、顯示數據、薪資與鎖定狀態的主要 API |
| `src/app/api/lineups/route.ts` | 已登入使用者的陣容讀取、新增、修改、刪除與伺服器端驗證 |
| `src/app/api/cron/` | 比賽與場均資料同步的受保護 Cron endpoints |
| `prisma/` | Prisma schema 與不可回改的資料庫 migrations |
| `scripts/` | 手動執行比賽、球員平均數據同步的命令列入口 |
| `vercel.json` | Cron 定義：比賽同步 `* * * * *`、球員平均數據同步 `30 16 * * *`；目前由 Vercel 功能開關停用 |

### 資料來源與持久化

- 比賽日與當日對戰主要取自 NBA.com games 頁面。
- 球員資料優先取 NBA 官方資料；不可用時使用 NBA player index、既有平均數據與 Basketball Reference 的 fallback 路徑。
- `PlayerAverageStats` 保存按球季與 regular season 的場均資料；`PlayerNameTranslation` 與 `TeamNameTranslation` 提供中文展示。
- 陣容儲存使用既有的 `Lineup`、`LineupPlayer`、`Player` 表；提交時會保存當時的薪資和統計快照，讓歷史陣容可重現。
- `CronExecution` 為 `sync-games` 的執行紀錄與健康檢查依據，記錄 job、trigger、status、details、開始及完成時間。

## 3. 核心邏輯

### 登入與頁面入口

- `/register` 建立使用者；`/login` 建立資料庫型 session；受保護頁面透過 `getCurrentUser()` 導向登入頁。
- `/` 是登入後首頁，提供兩個入口：`/lineups` 的「范特西陣容」與 `/predicted-starters` 的「預測首發」。
- 預測首發頁已建立完整入口與空狀態，但尚未接資料、模型或正式首發來源。

### 比賽日與陣容鎖定

- `game-window.ts` 將 status 2、3 或開賽時間已過的比賽判為已開始；status 1 明確視為未開賽。
- 球員池選擇下一個仍有未開賽比賽的比賽日。已開賽球隊被放入 `lockedTeamCodes`，該隊球員不可新增或替換。
- 一份陣容只有在該比賽日所有比賽都開始後才會從「目前陣容」進入「歷史陣容」。因此，某些球隊尚未開賽時，其球員仍可編輯。
- API 的 `POST` 與 `PUT` 都會再次驗證鎖定規則，不能只依前端按鈕狀態。編輯既有陣容時，原本已鎖定且未更換的球員被允許保留。

### 工資帽與球員身價

- 每份陣容固定為 PG、SG、SF、PF、C 五人，工資帽為 `$125`。
- 薪資範圍固定為 `$10` 至 `$60`，由 `src/lib/player-pricing.ts` 集中定義；球員池與陣容提交 API 都使用同一套函式，避免前後端或提交前後價格不一致。
- 夢幻分公式：

```text
分數 = 得分
     + 0.5 × 三分命中 + 0.4 × 投籃命中 - 投籃未命中
     + 0.2 × 罰球命中 - 0.5 × 罰球未命中
     + 進攻籃板 + 0.7 × 防守籃板
     + 1.5 × 助攻 + 2 × 抄截 + 1.8 × 阻攻 - 失誤
```

- 新球季樣本穩定機制：當季資料權重為 `min(出賽場數 / 20, 1)`；其餘權重使用上季夢幻分。沒有上季資料的新球員以 15 分 baseline 補足。這避免新球季剛開始時少量出賽直接使薪資劇烈波動。
- 薪資為 `round(60 × (穩定夢幻分 / 45)^1.05)`，最後 clamp 到 `[10, 60]`。這表示精英球員可達 `$60`，但 $60 是上限而非每位高分球員都應固定等值；未來應用實際分布持續校準。
- 顯示統計優先當季已出賽數據，沒有才退回上一季；定價統計也採相同球季選擇與穩定權重原則。

### 名稱、位置與搜尋

- 英文名、NBA player ID 或資料庫 ID 是身分與關聯的唯一真相；中文名只用於展示與搜尋。
- 翻譯查詢會把英文名正規化：移除重音、點、撇號、連字號與 Jr./Sr./羅馬後綴，以兼容命名差異。
- 球員池回傳 `name`（中文展示名）與 `englishName`；前端名稱搜尋同時比對兩者，因此可輸入中文或英文。
- `player-position-overrides` 對特定球員補正位置及可選 fantasy slots；不可用時使用原始 NBA position。
- 球隊顯示透過 tricode 對應中文名，但 tricode 仍是業務邏輯鍵值。

### 當前與歷史陣容

- `LineupPicker` 管理選位、同一球員不可重複選擇、隊伍篩選、夢幻分/得分/籃板/助攻/姓名排序、中文或英文姓名搜尋與工資帽提示。
- 已提交陣容依 `Lineup YYYY-MM-DD` 名稱解析比賽日。當前 tab 顯示目前比賽日，歷史 tab 預設最近的歷史日。
- 歷史陣容提供原生日期欄位「查看歷史陣容」，可切換查看過往有資料的比賽日，而不是一次顯示所有舊陣容。
- 提交時間採北京時間格式化，以修正 UI 與資料庫時間不一致的問題。

### 同步與運維

- `/api/cron/sync-games`：驗證 Cron 請求、建立 `CronExecution`、執行 `syncGamesOnce`、成功或失敗後回寫審計結果。
- `/api/cron/sync-player-average-stats`：驗證 Cron 請求並執行 `syncPlayerAverageStatsOnce`。
- 手動命令為 `pnpm games:sync` 與 `pnpm player-stats:sync`；它們會修改資料庫，只能在已設定正確環境變數且有明確需要時執行。
- 目前賽季休止，因此兩個 Vercel Cron 都停用。恢復時先確認賽程、資料來源與 `CRON_SECRET`，再在 Vercel 啟用 Cron Jobs。

## 4. 已完成工作與主要修改模組

| 範圍 | 已完成內容 | 主要模組或提交 |
| --- | --- | --- |
| 基礎系統 | 初始 Next.js、Prisma、登入 session、陣容和球員資料結構 | `635a22b`、`src/lib/auth.ts`、`src/lib/session-cookie.ts`、`prisma/` |
| Vercel 與同步 | 建立受保護 Cron endpoints、比賽同步、球員場均同步、執行審計 | `72489ff`、`0885a60`、`f339453`、`df36493`、`src/lib/nba-game-sync.ts`、`src/lib/player-average-stats-sync.ts` |
| 陣容體驗 | 建立/取消/刪除陣容、固定五人位置、工資帽、錯誤重試、桌面與手機版排版 | `0496220`、`56e1466`、`6e34da1`、`b51b445`、多個 mobile UI commits、`src/components/lineup-picker.tsx`、`src/app/wuxia-court.css` |
| 球員資料品質 | player pool fallback 去重、目前球季球隊 fallback、位置標籤與位置覆寫 | `f27bafe`、`501cc98`、`464cfd4`、`1bc33dc`、`src/lib/player-position-overrides.*` |
| 中文化 | 中文 UI、球員與球隊翻譯、統一展示名稱與雙語搜尋 | `312b0ae`、`0d4d7c4`、`0112d38`、`df36493`、`9204e46`、`src/lib/player-name-translations.ts`、`src/lib/team-name-translations.ts` |
| 鎖定規則 | 修正過早進入歷史陣容與過早鎖定的問題；改為只鎖已開賽球隊，全部比賽開始才歸檔 | `fcbf43b`、`96e52bc`、`src/lib/game-window.ts`、`src/app/api/lineups/route.ts` |
| 定價 | 範圍調整至 `$10-$60`，再統一為共享、帶新季樣本權重的穩定價格模型 | `f8aec1e`、`ba36a71`、`src/lib/player-pricing.ts`、`src/lib/player-pricing.test.ts` |
| 時間與歷史 | 修正提交時間時區，新增歷史陣容日期選擇 | `1fc9f9e`、`6388d2c`、`src/components/lineup-picker.tsx` |
| 首頁資訊架構 | 新首頁提供范特西陣容與預測首發兩個板塊；預測首發先以空狀態落地 | `212d1e1`、`src/app/page.tsx`、`src/app/predicted-starters/page.tsx` |
| 季外成本控制 | 停用 Vercel Cron、確認 Neon 5 分鐘自動休眠；無刪除程式碼、資料庫或專案 | Vercel/Neon 控制台操作，2026-07-28 驗證 |
| 專案治理 | 新增專案級 `AGENTS.md`，包含開發規範、交付命令與禁令 | `14eee61`、`AGENTS.md` |

## 5. 目前已知限制與待辦事項

### 賽季恢復前必做

1. 在 10 月重新確認 NBA 賽程、Vercel 環境變數與 Neon 連線正常後，於 Vercel 啟用 Cron Jobs。
2. 手動驗證一次 `sync-games` 與 `sync-player-average-stats` 的成功記錄，再觀察 `CronExecution` 與 `Game` 資料的新鮮度。
3. 用實際新球季資料檢查 `$10-$60` 分布，特別是前 20 場的薪資過渡與頂薪球員是否過度集中在 `$60`。

### 尚未實作的產品功能

1. 預測首發資料：目前只有頁面與空狀態；需選定資料來源、區分官方確認與預測、記錄可信度與更新時間。
2. 賽前選人情報：傷病狀態、先發/替補、球員對位、雙方交戰與攻守傾向、近況、預計上場時間、賠率/讓分/大小分，以及資訊來源與最後更新時間。
3. 比賽日結果：目前顯示的是場均夢幻分與提交快照；尚未形成完整的單日實際得分、結算、排行榜或回顧流程。
4. 聯盟層功能：Prisma schema 有 League、FantasyTeam、Draft、Matchup、Transaction 等模型，但目前主使用者流程仍是個人單日五人陣容，尚未完整實作選秀、交易、對戰、排名與聯盟管理。

### 工程與品質待辦

1. 為 API routes 補足整合測試，至少涵蓋登入、工資帽、鎖定、歷史歸檔、中文/英文搜尋及 Cron 授權失敗情況。
2. 建立受控的資料來源健康檢查與告警，只在失敗時通知；不得在健康狀態反覆建立聊天或背景任務。
3. 更新 `README.md` 的 Vercel Cron 說明，使其與現行 `vercel.json` 和「季外已停用」的實際狀態一致。
4. 對 NBA.com 與 Basketball Reference 上游錯誤建立更清楚的可觀測性與使用者提示；過去曾遇到 NBA upstream `502`，不能把 fallback 或舊資料誤稱為即時資料。
5. 檢查未翻譯球員名的資料品質；根目錄 `missing-player-chinese-names.xlsx` 是既有未追蹤檔案，除非使用者明確要求，不能覆蓋、刪除或提交。
6. UI 或資料流改動在提交前必須做對應的前端與後端實測；只通過 typecheck 或 build 不足以證明登入、API 和資料庫互動正確。

## 6. 開發與交付規則

```powershell
pnpm install
pnpm prisma:generate
pnpm typecheck
pnpm exec vitest run
pnpm build
.\run-dev.cmd
```

- 修改前先確認 `master` 已與 `origin/master` 同步；只暫存本次任務的檔案。
- 禁止輸出或提交 `.env*`、`DATABASE_URL`、`CRON_SECRET`、密碼、token 或完整連線字串。
- 未獲明確批准，不得寫入或遷移 production DB、執行同步、變更 Vercel Cron、刪除 Neon/Vercel 資源，或觸發 production deployment。
- 不得用中文名作為資料身分鍵；不要刪除其他人的未追蹤檔案或改動。
- 日誌、快取、下載與大型中間檔優先放在 D 槽，並避免提交生成物。
