#!/usr/bin/env python3
"""Build public KPI artifacts for the Real Estate Deals slice."""

from __future__ import annotations

import csv
import json
import os
import sys
from calendar import monthrange
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Callable
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "real-estate"
OUTPUT = OUTPUT_DIR / "deals-kpi.json"
TIMESERIES_OUTPUT = OUTPUT_DIR / "deals-timeseries.json"
MARKERS_OUTPUT = OUTPUT_DIR / "deals-markers.geojson"
SOURCE_CANDIDATES = [
    ROOT / "data" / "real-estate" / "deals-price-changes.csv",
    ROOT / "dist" / "real-estate" / "deals-price-changes.csv",
]
DEFAULT_AS_OF = date(2026, 6, 8)

RESIDENTIAL = "\u05de\u05d2\u05d5\u05e8\u05d9\u05dd"
IN_DISTRICT = "1.0"
NEXT_UPDATE_LABEL = "Q1 2027"
COORD_PRECISION = 5


def parse_quarter_key(key: str) -> tuple[int, int]:
    year, quarter = key.split("-Q")
    return int(year), int(quarter)


def parse_source_quarter_key(value: str) -> tuple[int, int] | None:
    if not value:
        return None
    try:
        part, year = value.split("_")
        if not part.startswith("q"):
            return None
        quarter = int(part[1:])
        year_int = int(year)
    except ValueError:
        return None
    if quarter < 1 or quarter > 4:
        return None
    return year_int, quarter


def parse_month_key(key: str) -> tuple[int, int]:
    year, month = key.split("-")
    return int(year), int(month)


def format_quarter_key(year: int, quarter: int) -> str:
    return f"{year:04d}-Q{quarter}"


def quarter_label(key: str) -> str:
    year, num = parse_quarter_key(key)
    return f"Q{num} {year}"


def month_label(key: str) -> str:
    year, month = parse_month_key(key)
    return date(year, month, 1).strftime("%b %Y")


def quarter_end(key: str) -> date:
    year, num = parse_quarter_key(key)
    end_month = num * 3
    return date(year, end_month, monthrange(year, end_month)[1])


def month_end(key: str) -> date:
    year, month = parse_month_key(key)
    return date(year, month, monthrange(year, month)[1])


def parse_iso_date(value: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def month_key_from_date(value: str) -> str | None:
    parsed = parse_iso_date(value)
    if parsed is None:
        return None
    return f"{parsed.year:04d}-{parsed.month:02d}"


def quarter_key_from_date(value: str) -> str | None:
    parsed = parse_iso_date(value)
    if parsed is None:
        return None
    quarter = ((parsed.month - 1) // 3) + 1
    return format_quarter_key(parsed.year, quarter)


def month_key_from_source(value: str) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%B %Y").date()
    except ValueError:
        return None
    return f"{parsed.year:04d}-{parsed.month:02d}"


def quarter_key_from_source(value: str) -> str | None:
    parsed = parse_source_quarter_key(value)
    if parsed is None:
        return None
    year, quarter = parsed
    return format_quarter_key(year, quarter)


def is_quarter_complete(key: str, as_of: date) -> bool:
    return as_of > quarter_end(key)


def is_month_complete(key: str, as_of: date) -> bool:
    return as_of > month_end(key)


def next_quarter_label(key: str) -> str:
    year, num = parse_quarter_key(key)
    if num == 4:
        return f"Q1 {year + 1}"
    return f"Q{num + 1} {year}"


def year_ago_quarter_key(key: str) -> str:
    year, quarter = parse_quarter_key(key)
    return format_quarter_key(year - 1, quarter)


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


def to_float(value: str) -> float | None:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def to_int_or_float(value: float) -> int | float:
    if value.is_integer():
        return int(value)
    return value


def maybe_number(value: str) -> int | float | None:
    parsed = to_float(value)
    if parsed is None:
        return None
    return to_int_or_float(parsed)


def median(values: list[float]) -> int | float | None:
    if not values:
        return None
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return to_int_or_float(ordered[middle])
    return to_int_or_float((ordered[middle - 1] + ordered[middle]) / 2)


def has_coordinates(row: dict[str, str]) -> bool:
    return to_float(row.get("x", "")) is not None and to_float(row.get("y", "")) is not None


def normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    if "×" not in value:
        return value
    try:
        repaired = value.encode("cp1252").decode("utf-8")
    except UnicodeError:
        return value
    return repaired


def normalized_row_periods(row: dict[str, str]) -> tuple[str | None, str | None]:
    deal_date = row.get("deal_date", "")
    month_key = month_key_from_date(deal_date)
    quarter_key = quarter_key_from_date(deal_date)
    if month_key is None:
        month_key = month_key_from_source(row.get("month_and_year", ""))
    if quarter_key is None:
        quarter_key = quarter_key_from_source(row.get("quarter_and_year", ""))
    return month_key, quarter_key


def find_source() -> Path | None:
    for path in SOURCE_CANDIDATES:
        if path.is_file():
            return path
    return None


def build_period_rollup(
    grouped_rows: dict[str, list[dict[str, str]]],
    *,
    as_of: date,
    label_for: Callable[[str], str],
    is_complete: Callable[[str, date], bool],
    sort_key: Callable[[str], tuple[int, int]],
) -> list[dict[str, object]]:
    periods: list[dict[str, object]] = []
    for period in sorted(grouped_rows, key=sort_key):
        district_deals = 0
        non_district_deals = 0
        district_prices: list[float] = []
        non_district_prices: list[float] = []

        for row in grouped_rows[period]:
            price_per_sqm = to_float(row.get("price_per_sqm", ""))
            if row.get("in_innovation_district") == IN_DISTRICT:
                district_deals += 1
                if price_per_sqm is not None:
                    district_prices.append(price_per_sqm)
            else:
                non_district_deals += 1
                if price_per_sqm is not None:
                    non_district_prices.append(price_per_sqm)

        periods.append(
            {
                "period": period,
                "label": label_for(period),
                "complete": is_complete(period, as_of),
                "districtDeals": district_deals,
                "nonDistrictDeals": non_district_deals,
                "districtMedianPricePerSqm": median(district_prices),
                "nonDistrictMedianPricePerSqm": median(non_district_prices),
            }
        )

    return periods


def resolve_as_of() -> date:
    value = os.environ.get("REAL_ESTATE_KPI_AS_OF")
    if not value:
        return DEFAULT_AS_OF
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(
            f"build-real-estate-kpi: invalid REAL_ESTATE_KPI_AS_OF {value!r}; expected YYYY-MM-DD"
        ) from exc


def build_markers(rows: list[dict[str, str]]) -> dict[str, object]:
    features: list[dict[str, object]] = []
    for index, row in enumerate(rows):
        x = to_float(row.get("x", ""))
        y = to_float(row.get("y", ""))
        period_month, period_quarter = normalized_row_periods(row)

        if x is None or y is None or period_quarter is None:
            continue

        price_per_sqm = maybe_number(row.get("price_per_sqm", ""))
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(x, COORD_PRECISION), round(y, COORD_PRECISION)],
                },
                "properties": {
                    "periodMonth": period_month,
                    "periodQuarter": period_quarter,
                    "inInnovationDistrict": row.get("in_innovation_district") == IN_DISTRICT,
                    "propertyCategory": normalize_text(row.get("property_category")),
                    "propertyType": normalize_text(row.get("property_type")),
                    "dealAmount": maybe_number(row.get("deal_amount", "")),
                    "pricePerSqm": round(price_per_sqm, 2) if price_per_sqm is not None else None,
                    "areaSqm": maybe_number(row.get("area_of_asset_sqm", "")),
                },
                "_sortIndex": index,
            }
        )

    features.sort(
        key=lambda feature: (
            feature["properties"]["periodQuarter"] or "",
            feature["properties"]["periodMonth"] or "",
            feature["properties"]["periodQuarter"],
            feature["geometry"]["coordinates"][0],
            feature["geometry"]["coordinates"][1],
            feature["properties"]["dealAmount"] if feature["properties"]["dealAmount"] is not None else float("-inf"),
            feature["properties"]["pricePerSqm"] if feature["properties"]["pricePerSqm"] is not None else float("-inf"),
            feature["properties"]["areaSqm"] if feature["properties"]["areaSqm"] is not None else float("-inf"),
            feature["properties"]["propertyCategory"] or "",
            feature["properties"]["propertyType"] or "",
            feature["_sortIndex"],
        )
    )

    quarter_counters: defaultdict[str, int] = defaultdict(int)
    for feature in features:
        period_quarter = feature["properties"]["periodQuarter"].lower()
        quarter_counters[period_quarter] += 1
        feature["properties"] = {
            "id": f"deal-{period_quarter}-{quarter_counters[period_quarter]:04d}",
            **feature["properties"],
        }
        del feature["_sortIndex"]

    return {
        "type": "FeatureCollection",
        "features": features,
    }


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

    try:
        as_of = resolve_as_of()
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    residential_rows = [
        row for row in rows if normalize_text(row.get("property_category")) == RESIDENTIAL
    ]
    district_quarter_rows = [
        row
        for row in residential_rows
        if row.get("in_innovation_district") == IN_DISTRICT and normalized_row_periods(row)[1] is not None
    ]

    by_quarter = Counter(
        quarter_key
        for row in district_quarter_rows
        for quarter_key in [normalized_row_periods(row)[1]]
        if quarter_key is not None
    )
    complete_keys = sorted(
        (key for key in by_quarter if is_quarter_complete(key, as_of)),
        key=parse_quarter_key,
    )

    if len(complete_keys) < 2:
        print("build-real-estate-kpi: not enough complete quarters", file=sys.stderr)
        return 1

    current_key = complete_keys[-1]
    previous_key = year_ago_quarter_key(current_key)
    if previous_key not in by_quarter:
        print(
            f"build-real-estate-kpi: missing year-ago quarter {previous_key!r} for {current_key!r}",
            file=sys.stderr,
        )
        return 1
    current_count = by_quarter[current_key]
    previous_count = by_quarter[previous_key]
    delta = current_count - previous_count

    monthly_rows: defaultdict[str, list[dict[str, str]]] = defaultdict(list)
    quarterly_rows: defaultdict[str, list[dict[str, str]]] = defaultdict(list)
    for row in residential_rows:
        month_key, quarter_key = normalized_row_periods(row)
        if month_key is not None:
            monthly_rows[month_key].append(row)
        if quarter_key is not None:
            quarterly_rows[quarter_key].append(row)

    payload = {
        "periodLabel": quarter_label(current_key),
        "currentValue": f"{current_count:,}",
        "deltaValue": format_delta(delta),
        "deltaDirection": delta_direction(delta),
        "baselinePeriodLabel": quarter_label(previous_key),
        "baselineValue": f"{previous_count:,}",
        "nextUpdateLabel": NEXT_UPDATE_LABEL,
    }

    timeseries_payload = {
        "generatedAt": as_of.isoformat(),
        "source": source.relative_to(ROOT).as_posix(),
        "summary": {
            "totalRows": len(rows),
            "residentialRows": len(residential_rows),
            "rowsWithCoordinates": sum(1 for row in rows if has_coordinates(row)),
            "missingCoordinates": sum(1 for row in rows if not has_coordinates(row)),
            "rowsMissingDealDate": sum(1 for row in rows if parse_iso_date(row.get("deal_date", "")) is None),
        },
        "monthly": build_period_rollup(
            monthly_rows,
            as_of=as_of,
            label_for=month_label,
            is_complete=is_month_complete,
            sort_key=parse_month_key,
        ),
        "quarterly": build_period_rollup(
            quarterly_rows,
            as_of=as_of,
            label_for=quarter_label,
            is_complete=is_quarter_complete,
            sort_key=parse_quarter_key,
        ),
    }

    markers_payload = build_markers(residential_rows)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    TIMESERIES_OUTPUT.write_text(
        json.dumps(timeseries_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    MARKERS_OUTPUT.write_text(
        json.dumps(markers_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(
        f"Wrote {OUTPUT.relative_to(ROOT)} "
        f"({payload['periodLabel']}: {payload['currentValue']}, source={source.relative_to(ROOT)})"
    )
    print(f"Wrote {TIMESERIES_OUTPUT.relative_to(ROOT)}")
    print(f"Wrote {MARKERS_OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
