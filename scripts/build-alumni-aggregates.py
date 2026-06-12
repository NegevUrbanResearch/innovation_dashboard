#!/usr/bin/env python3
"""Build public aggregate CSVs for the alumni / cohort KPI slice."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "alumni"

sys.path.insert(0, str(ROOT / "scripts"))

from alumni.cohort_exports import build_cohort_venn_overlap
from alumni.graduation_exports import build_education_field_by_graduation_year_bs_workers
from alumni.paths import CLEANED_FLAGS_PATH
from alumni.residence_work import analyze_residence_work
from alumni.treemap_exports import build_bs_workers_treemap

_FORBIDDEN_COLUMN_NAMES = frozenset(
    {
        "profile_url",
        "full_name",
        "email",
        "phone",
        "linkedin_url",
        "linkedin_id",
        "bio",
        "headline",
        "first_name",
        "last_name",
        "name",
    }
)

_DASHBOARD_AGGREGATE_KEYS = (
    "cohort_venn_overlap",
    "bgu_treemap_drilldown_agg",
    "feeder_cities",
)


def _to_dataframe(value: pd.DataFrame | pd.Series, *, label: str) -> pd.DataFrame:
    if isinstance(value, pd.DataFrame):
        return value.copy()
    if isinstance(value, pd.Series):
        frame = value.rename("count").reset_index()
        if label == "feeder_cities" and frame.columns[0] != "residence_city":
            frame = frame.rename(columns={frame.columns[0]: "residence_city"})
        return frame
    raise TypeError(f"Unsupported export type for {label}: {type(value)!r}")


def _assert_export_gate(frame: pd.DataFrame, *, label: str, profile_count: int) -> None:
    lowered = {str(col).lower() for col in frame.columns}
    forbidden = lowered & _FORBIDDEN_COLUMN_NAMES
    if forbidden:
        raise ValueError(
            f"Export gate failed for {label}: forbidden column(s) {sorted(forbidden)}"
        )

    row_count = len(frame)
    if row_count > profile_count:
        raise ValueError(
            f"Export gate failed for {label}: {row_count:,} rows exceeds profile count "
            f"{profile_count:,} (possible profile-level leak)"
        )


def write_csv(path: Path, value: pd.DataFrame | pd.Series, *, label: str, profile_count: int) -> None:
    frame = _to_dataframe(value, label=label)
    _assert_export_gate(frame, label=label, profile_count=profile_count)
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    print(f"Wrote {path.relative_to(ROOT)} ({len(frame):,} rows)")


def _load_cleaned_flags() -> pd.DataFrame:
    if not CLEANED_FLAGS_PATH.is_file():
        raise FileNotFoundError(
            f"Missing {CLEANED_FLAGS_PATH}. Run one-time bootstrap (copy from sibling "
            f"linkedin-analysis data/processed/cleaned_flags.csv) — see README."
        )
    return pd.read_csv(CLEANED_FLAGS_PATH, low_memory=False)


def main() -> int:
    try:
        df = _load_cleaned_flags()
    except FileNotFoundError as exc:
        print(f"build-alumni-aggregates: {exc}", file=sys.stderr)
        return 1

    profile_count = len(df)
    print(f"Loaded {profile_count:,} profiles from {CLEANED_FLAGS_PATH.relative_to(ROOT)}")

    results = analyze_residence_work(df)
    results["cohort_venn_overlap"] = build_cohort_venn_overlap(df)

    df_bgu = df.loc[df["is_bgu_grad"]].copy()

    for key in _DASHBOARD_AGGREGATE_KEYS:
        if key not in results:
            if key == "feeder_cities":
                results[key] = pd.DataFrame(columns=["residence_city", "count"])
            else:
                raise KeyError(f"Expected analysis result missing: {key}")
        write_csv(OUTPUT_DIR / f"{key}.csv", results[key], label=key, profile_count=profile_count)

    write_csv(
        OUTPUT_DIR / "bgu_treemap_drilldown_agg_bs_workers.csv",
        build_bs_workers_treemap(df_bgu),
        label="bgu_treemap_drilldown_agg_bs_workers",
        profile_count=profile_count,
    )
    write_csv(
        OUTPUT_DIR / "education_field_by_graduation_year_bs_workers.csv",
        build_education_field_by_graduation_year_bs_workers(df_bgu),
        label="education_field_by_graduation_year_bs_workers",
        profile_count=profile_count,
    )

    split_script = ROOT / "scripts" / "split-bgu-treemap-south-panel.mjs"
    print(f"Running {split_script.relative_to(ROOT)} …")
    subprocess.run(["node", str(split_script)], check=True, cwd=ROOT)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
