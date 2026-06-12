#!/usr/bin/env python3
from __future__ import annotations

import pandas as pd

from alumni.residence_work import _attach_quality_denominators


def build_education_field_by_graduation_year_bs_workers(df_bgu: pd.DataFrame) -> pd.DataFrame:
    """BGU × works in Beer Sheva: graduation year × fine education field counts with quality denominators."""
    df_bs = df_bgu.loc[df_bgu["works_in_beer_sheva"].fillna(False)].copy()
    n_total = len(df_bs)

    known_mask = df_bs["education_end_year"].notna()
    if "education_field_fine" in df_bs.columns:
        known_mask = known_mask & df_bs["education_field_fine"].fillna("").astype(str).str.strip().ne("")
    else:
        known_mask = pd.Series(False, index=df_bs.index)

    n_known = int(known_mask.sum())
    if n_known:
        sub = df_bs.loc[known_mask].copy()
        sub["education_end_year_int"] = sub["education_end_year"].astype(int)
        tbl = (
            sub.groupby(["education_end_year_int", "education_field_fine"], dropna=False)
            .size()
            .reset_index(name="count")
            .rename(columns={"education_end_year_int": "education_end_year"})
        )
    else:
        tbl = pd.DataFrame(columns=["education_end_year", "education_field_fine", "count"])

    return _attach_quality_denominators(tbl, n_total, n_known)
