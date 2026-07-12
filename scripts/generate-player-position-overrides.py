"""Build the checked-in fantasy position map from the supplied player workbook."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    without_marks = "".join(character for character in decomposed if not unicodedata.combining(character))
    without_punctuation = re.sub(r"[.'\u2019-]", "", without_marks)
    without_suffix = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", without_punctuation, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", without_suffix).strip().lower()


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"D:\projects\fetch_player_position\active_nba_players.xlsx")
    target = Path(__file__).resolve().parents[1] / "src" / "lib" / "player-position-overrides.json"
    players = pd.read_excel(source, sheet_name="Active Players")
    mapping = {
        normalize(name): position
        for name, position in zip(players["Name"], players["Position"])
        if isinstance(name, str) and isinstance(position, str)
    }

    target.write_text(json.dumps(dict(sorted(mapping.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(mapping)} position overrides to {target}")


if __name__ == "__main__":
    main()
