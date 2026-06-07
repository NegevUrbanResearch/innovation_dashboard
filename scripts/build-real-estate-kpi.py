#!/usr/bin/env python3
"""Build a small presentation JSON for the Real Estate Deals KPI card."""

from __future__ import annotations

import csv
import json
import sys
from calendar import monthrange
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "real-estate" / "deals-kpi.json"
SOURCE_CANDIDATES = [
    ROOT / "data" / "real-estate" / "deals-price-changes.csv",
    ROOT / "dist" / "real-estate" / "deals-price-changes.csv",
]

RESIDENTIAL = "מגורים"
IN_DISTRICT = "1.0"


def parse_quarter_key(key: str) -> tuple[int, int]:
    part, year = key.split("_")
    return int(year), int(part[1:])


def quarter_label(key: str) -> str:
    year, num = parse_quarter_key(key)
    return f"Q{num} {year}"


def quarter_end(key: str) -> date:
    year, num = parse_quarter_key(key)
    end_month = num * 3
    return date(year, end_month, monthrange(year, end_month)[1])


def is_quarter_complete(key: str, as_of: date) -> bool:
    return as_of > quarter_end(key)


def next_quarter_label(key: str) -> str:
    year, num = parse_quarter_key(key)
    if num == 4:
        return f"Q1 {year + 1}"
    return f"Q{num + 1} {year}"


def format_delta(delta: int) -> str:
    if delta > 0:
        return f"+{delta:,}"
    if delta < 0:
        return f"{delta:,}"
    return "0"


def delta_direction(delta: int) -> str:
    if delta > 0:
        return "up"
    if delta < 0:
        return "down"
    return "flat"


def find_source() -> Path | None:
    for path in SOURCE_CANDIDATES:
        if path.is_file():
            return path
    return None


def main() -> int:
    source = find_source()
    if source is None:
        print(
            "build-real-estate-kpi: source CSV not found; keeping existing public JSON",
            file=sys.stderr,
        )
        return 0

    with source.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    filtered = [
        r
        for r in rows
        if r.get("property_category") == RESIDENTIAL
        and r.get("in_innovation_district") == IN_DISTRICT
        and r.get("quarter_and_year")
    ]

    by_quarter = Counter(r["quarter_and_year"] for r in filtered)
    complete_keys = sorted(
        (key for key in by_quarter if is_quarter_complete(key, date.today())),
        key=parse_quarter_key,
    )

    if len(complete_keys) < 2:
        print("build-real-estate-kpi: not enough complete quarters", file=sys.stderr)
        return 1

    current_key = complete_keys[-1]
    previous_key = complete_keys[-2]
    current_count = by_quarter[current_key]
    previous_count = by_quarter[previous_key]
    delta = current_count - previous_count

    payload = {
        "periodLabel": quarter_label(current_key),
        "currentValue": f"{current_count:,}",
        "deltaValue": format_delta(delta),
        "deltaDirection": delta_direction(delta),
        "baselinePeriodLabel": quarter_label(previous_key),
        "baselineValue": f"{previous_count:,}",
        "nextUpdateLabel": next_quarter_label(current_key),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUTPUT.relative_to(ROOT)} "
        f"({payload['periodLabel']}: {payload['currentValue']}, source={source.relative_to(ROOT)})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
