"""Read-only Vercel probe for NBA tracking data through nba_api."""

import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from scripts.fetch_player_ball_share import SOURCE_URL, collect_window


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        secret = os.environ.get("CRON_SECRET")
        if not secret:
            self.respond(500, {"ok": False, "error": "CRON_SECRET is not configured"})
            return
        if self.headers.get("Authorization") != f"Bearer {secret}":
            self.respond(401, {"ok": False, "error": "Unauthorized"})
            return

        season = parse_qs(urlparse(self.path).query).get("season", ["2025-26"])[0]
        if not re.fullmatch(r"\d{4}-\d{2}", season):
            self.respond(400, {"ok": False, "error": "season must use YYYY-YY format"})
            return

        started_at = time.monotonic()
        try:
            rows = collect_window(season, 0)
            self.respond(200, {
                "ok": True,
                "season": season,
                "sourceUrl": SOURCE_URL,
                "metrics": {name: len(value) for name, value in rows.items()},
                "durationMs": round((time.monotonic() - started_at) * 1000),
            })
        except Exception as error:
            self.respond(502, {
                "ok": False,
                "season": season,
                "error": str(error),
                "durationMs": round((time.monotonic() - started_at) * 1000),
            })

    def respond(self, status, body):
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
