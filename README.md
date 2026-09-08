# Fantasy NBA System

A daily five-player NBA lineup tool built with Next.js, Prisma, and PostgreSQL.

## MVP scope

- Authenticated daily lineups with PG, SG, SF, PF and C slots under a $125 salary cap
- NBA player pool, current and historical saved lineups, and per-team game locks
- Real game-day fantasy rankings with unstarted players hidden on the server
- Player intelligence from synced game statistics; predicted starters currently has no data source

## Street Court frontend

The production UI follows the approved `demos/street-court/` concept: asphalt black, orange, cream, locally bundled Anton lettering, a desktop lineup court, animated ranking changes and an interactive court showing only publicly available started players. Authentication, salary, locking and persistence rules are unchanged.

Player intelligence has one Chinese/English name search. Selecting a result updates the report using real dashboard statistics. Search covers the players eligible for that dashboard (upcoming games and enough historical samples), not every NBA player. Missing games or samples are explained in the page. No simulated metrics or predicted starters are shipped into production.

The shared styles are `src/app/globals.css` and `src/app/street.css`; rankings also use `src/app/rankings/ranking.css`. Anton is packaged with `next/font/local`; its license is in `public/fonts/OFL.txt`. The standalone demo remains a separate local artifact and does not call production APIs.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Install dependencies with `pnpm install`.
3. Run `pnpm prisma:generate`.
4. Run `pnpm prisma:migrate -- --name init` when a database is ready.
5. Start local dev with `pnpm dev`.

The website is protected by a database-backed login session. New users should open `/register`, create an account, and then they will be redirected into the app. Existing users can use `/login`.

## NBA data sync

Run these commands after setting `DATABASE_URL`:

- `pnpm games:sync` inserts or updates `Game` rows and records final NBA regular-season Box Scores in `PlayerGameStats`, then calculates `PlayerAverageStats` from those completed games.
- `pnpm games:watch` keeps `Game` scores and status refreshed while games are live.
- `pnpm player-stats:sync` recalculates `PlayerAverageStats` from the saved official NBA Box Scores. It does not request `stats.nba.com`.

Lineup player cards prefer the current season averages. If a player has no current season average, the app falls back to the previous season average. If no saved Box Scores are available, the app falls back to the limited official `playerIndex` fields.

`/player-intel` is the pregame player-intelligence page. It calculates role change from the latest 5 played games versus the preceding 10, and calculates the game-day recommendation from season fantasy output, recent form, role change, opponent fantasy output allowed, and recent pace. It is read-only and requires a synced upcoming `Game` plus at least 15 current-season player games; otherwise it shows an explicit unavailable state.

All database business timestamps are stored as Beijing time.

## Vercel deployment

Use the default Vercel Next.js settings:

- Root Directory: `./`
- Build Command: `pnpm build`
- Output Directory: Next.js default
- Install Command: `pnpm install`

Set these environment variables in Vercel for Production and Preview:

- `DATABASE_URL`: the Neon pooled PostgreSQL connection string.
- `CRON_SECRET`: a random string of at least 16 characters.
- `NEXT_PUBLIC_APP_NAME`: optional, for example `Fantasy NBA`.

The app defines Vercel Cron endpoints:

- `/api/cron/sync-games` updates the `Game` table.
- `/api/cron/sync-player-average-stats` updates `PlayerAverageStats`.

These endpoints require `Authorization: Bearer <CRON_SECRET>`. Vercel automatically sends this header to cron jobs when `CRON_SECRET` is configured.

The checked-in `vercel.json` defines games every minute, averages at `30 16 * * *`, and positions at `0 22 * * 0`. These definitions do not prove that Cron is enabled in Vercel. Verify the dashboard before operational changes; a frontend deployment does not authorize enabling Cron or manually running synchronization.

The first implementation uses a points-league ruleset because it is easier to validate before adding 9-cat scoring.

## Live rankings

`/rankings` is a login-protected, read-only leaderboard. It polls `/api/rankings?date=YYYY-MM-DD` every 30 seconds while the page is visible. Dates are NBA Eastern-time game dates; retrieval times are displayed in Beijing time.

For each user, it selects the most recently updated `Lineup` named `Lineup YYYY-MM-DD`, then reads its five slots through `LineupPlayer` and `Player`. User display names come from `User.name`; emails and user IDs are not exposed. Legacy lineups without a dated name are not included. Multiple lineups on one day produce one ranking entry per user.

The server uses the official NBA scoreboard (with the dated NBA games page as fallback) and complete official box scores for all started games. Scores use the shared `fantasyScore()` formula, not stored averages or `Lineup.totalPoints`. Numeric NBA player IDs are primary; legacy nonnumeric identities can match a unique normalized English name. Chinese translations are display-only. Unknown players and incomplete statistics stay unavailable, not zero; incomplete entries suspend ordinal ranking. Official zero statistics remain zero, including DNPs.

Only official game status 2 (in progress) or 3 (finished) reveals a selected player. Unstarted/unknown players are filtered on the server and never serialized into the response. Finished players remain visible. API responses are private and no-store; upstream fetches revalidate after 20 seconds. No migration, database write, or Cron change is required.

The standalone interactive prototype remains under `demos/live-ranking/`; its simulated data and controls are not used by the production route.
