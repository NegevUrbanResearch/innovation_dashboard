#!/usr/bin/env python3
from __future__ import annotations

import pandas as pd


def _cohort_venn_overlap_partition_counts(
    df: pd.DataFrame,
) -> tuple[tuple[int, int, int, int, int, int, int], dict[str, int]]:
    set_bgu = set(df.index[df["is_bgu_grad"]])
    set_res = set(df.index[df["lives_in_beer_sheva"]])
    set_wrk = set(df.index[df["works_in_beer_sheva"]])

    only_bgu = len(set_bgu - set_res - set_wrk)
    only_res = len(set_res - set_bgu - set_wrk)
    bgu_and_res = len((set_bgu & set_res) - set_wrk)
    only_wrk = len(set_wrk - set_bgu - set_res)
    bgu_and_wrk = len((set_bgu & set_wrk) - set_res)
    res_and_wrk = len((set_res & set_wrk) - set_bgu)
    all_three = len(set_bgu & set_res & set_wrk)
    subsets = (only_bgu, only_res, bgu_and_res, only_wrk, bgu_and_wrk, res_and_wrk, all_three)
    meta = {
        "total_profiles": len(df),
        "n_bgu_graduates": len(set_bgu),
        "n_beer_sheva_residents": len(set_res),
        "n_beer_sheva_workers": len(set_wrk),
    }
    return subsets, meta


def build_cohort_venn_overlap(df: pd.DataFrame) -> pd.DataFrame:
    """Long table for chart 01 / KPI card: venn partitions + set totals."""
    subsets, meta = _cohort_venn_overlap_partition_counts(df)
    part_keys = [
        "only_bgu",
        "only_beer_sheva_resident",
        "bgu_and_resident_not_worker",
        "only_beer_sheva_worker",
        "bgu_and_worker_not_resident",
        "resident_and_worker_not_bgu",
        "bgu_resident_and_worker",
    ]
    rows: list[dict[str, object]] = [
        {"row_kind": "venn_partition", "segment": k, "count": int(c)} for k, c in zip(part_keys, subsets)
    ]
    for k, v in meta.items():
        rows.append({"row_kind": "set_or_cohort_total", "segment": k, "count": int(v)})
    return pd.DataFrame(rows)
