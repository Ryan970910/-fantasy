# Fantasy NBA System

A clean Yahoo Fantasy NBA style league system built with Next.js, Prisma, and PostgreSQL.

## MVP scope

- League creation and membership
- Fantasy teams
- NBA player pool
- Snake draft model
- Roster slots
- Points-league scoring
- Weekly matchups and standings
- Free-agent transaction model

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Install dependencies with `pnpm install`.
3. Run `pnpm prisma:generate`.
4. Run `pnpm prisma:migrate -- --name init` when a database is ready.
5. Start local dev with `pnpm dev`.

The website is protected by a database-backed login session. New users should open `/register`, create an account, and then they will be redirected into the app. Existing users can use `/login`.

## NBA data sync

Run these commands after setting `DATABASE_URL`:

- `pnpm games:sync` inserts or updates next game day rows in `Game`.
- `pnpm games:watch` keeps `Game` scores and status refreshed while games are live.
- `pnpm player-stats:sync` pulls per-game player averages from NBA official `LeagueDashPlayerStats` for the current NBA season and previous NBA season, then upserts them into `PlayerAverageStats`.

Lineup player cards prefer the current season averages. If a player has no current season average, the app falls back to the previous season average. If the stats sync has not run or NBA's stats endpoint is unavailable, the app falls back to the limited official `playerIndex` fields.

All database business timestamps are stored as Beijing time.

The first implementation uses a points-league ruleset because it is easier to validate before adding 9-cat scoring.
