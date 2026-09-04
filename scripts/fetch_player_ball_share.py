"""Collect NBA player ball-share windows with nba_api and print JSON for the TypeScript sync."""

import argparse
import json
import sys
import time

from nba_api.stats.endpoints import leaguedashplayerstats, leaguedashptstats

REQUEST_DELAY_SECONDS = 3.5
RETRY_DELAY_SECONDS = 5
REQUEST_TIMEOUT_SECONDS = 30
SOURCE_URL = "https://www.nba.com/stats/players/advanced"
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.nba.com",
    "Referer": "https://www.nba.com/stats/players/touches",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
}


def normalized_rows(endpoint, column):
    datasets = endpoint.get_normalized_dict()
    rows = next((value for value in datasets.values() if isinstance(value, list)), None)
    if rows is None:
        raise RuntimeError("nba_api returned no result set")
    result = []
    for row in rows:
        player_id = str(row.get("PLAYER_ID") or "")
        player_name = str(row.get("PLAYER_NAME") or "")
        if not player_id or not player_name:
            continue
        value = row.get(column)
        if value is None:
            continue
        result.append({
            "playerId": player_id,
            "playerName": player_name,
            "team": str(row.get("TEAM_ABBREVIATION") or ""),
            "gamesPlayed": int(float(row.get("GP") or 0)),
            "value": float(value),
        })
    return result


def with_retry(fetch):
    error = None
    for attempt in range(2):
        try:
            return fetch()
        except Exception as caught:  # nba_api forwards requests exceptions without a shared base type.
            error = caught
            if attempt == 0:
                time.sleep(RETRY_DELAY_SECONDS)
    raise RuntimeError(f"nba_api request failed: {error}") from error


def usage_rows(season, last_games):
    return with_retry(lambda: normalized_rows(leaguedashplayerstats.LeagueDashPlayerStats(
        last_n_games=str(last_games),
        measure_type_detailed_defense="Advanced",
        per_mode_detailed="PerGame",
        season=season,
        season_type_all_star="Regular Season",
        headers=HEADERS,
        timeout=REQUEST_TIMEOUT_SECONDS,
    ), "USG_PCT"))


def possession_rows(season, last_games):
    endpoint = with_retry(lambda: leaguedashptstats.LeagueDashPtStats(
        last_n_games=str(last_games),
        per_mode_simple="PerGame",
        player_or_team="Player",
        pt_measure_type="Possessions",
        season=season,
        season_type_all_star="Regular Season",
        headers=HEADERS,
        timeout=REQUEST_TIMEOUT_SECONDS,
    ))
    return normalized_rows(endpoint, "TOUCHES"), normalized_rows(endpoint, "TIME_OF_POSS")


def potential_assist_rows(season, last_games):
    return with_retry(lambda: normalized_rows(leaguedashptstats.LeagueDashPtStats(
        last_n_games=str(last_games),
        per_mode_simple="PerGame",
        player_or_team="Player",
        pt_measure_type="Passing",
        season=season,
        season_type_all_star="Regular Season",
        headers=HEADERS,
        timeout=REQUEST_TIMEOUT_SECONDS,
    ), "POTENTIAL_AST"))


def collect_window(season, last_games):
    usage = usage_rows(season, last_games)
    time.sleep(REQUEST_DELAY_SECONDS)
    touches, possession_time = possession_rows(season, last_games)
    time.sleep(REQUEST_DELAY_SECONDS)
    potential_assists = potential_assist_rows(season, last_games)
    return {"usageRate": usage, "touches": touches, "timePossession": possession_time, "potentialAssists": potential_assists}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", required=True)
    parser.add_argument("--probe", action="store_true")
    args = parser.parse_args()

    if args.probe:
        window = collect_window(args.season, 0)
        print(json.dumps({"season": args.season, "sourceUrl": SOURCE_URL, "metrics": {name: len(rows) for name, rows in window.items()}}))
        return

    metrics = {name: {"0": [], "5": [], "10": []} for name in ("usageRate", "timePossession", "touches", "potentialAssists")}
    for index, last_games in enumerate((0, 5, 10)):
        window = collect_window(args.season, last_games)
        for name, rows in window.items():
            metrics[name][str(last_games)] = rows
        if index < 2:
            time.sleep(REQUEST_DELAY_SECONDS)
    print(json.dumps({"season": args.season, "sourceUrl": SOURCE_URL, "metrics": metrics}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
