#!/usr/bin/env python3
from __future__ import annotations

import pandas as pd

_BAD_PLACEHOLDER_EMPLOYER_TOKENS = frozenset({"NA", "N/A", "NAN"})

_UNRESOLVED_EDUCATION_BUCKET_FOR_LONG = frozenset(
    {"unknown", "needs_review", "unspecified", "no_education", "nan"}
)


def _bgu_company_education_field_display(df: pd.DataFrame) -> pd.Series:
    """
    Prefer non-empty trimmed ``education_field_fine``; else meaningful ``education_bucket``;
    else the literal ``unknown``.
    """
    if "education_field_fine" in df.columns:
        fine = df["education_field_fine"].fillna("").astype(str).str.strip()
    else:
        fine = pd.Series("", index=df.index, dtype=object)
    fine_ok = fine.ne("") & fine.str.lower().ne("nan")

    if "education_bucket" in df.columns:
        bucket = df["education_bucket"].fillna("").astype(str).str.strip()
        low = bucket.str.lower()
        bucket_ok = bucket.ne("") & ~low.isin(_UNRESOLVED_EDUCATION_BUCKET_FOR_LONG)
    else:
        bucket_ok = pd.Series(False, index=df.index)

    out = pd.Series("unknown", index=df.index, dtype=object)
    out.loc[fine_ok] = fine.loc[fine_ok].values
    use_bucket = (~fine_ok) & bucket_ok
    out.loc[use_bucket] = bucket.loc[use_bucket].values
    return out


def build_bgu_treemap_drilldown_agg(df_subset: pd.DataFrame, residence_panel: pd.Series) -> pd.DataFrame:
    """Long aggregate: residence_panel × industry_bucket × industry_segment × employer × education → n."""
    _emp_raw = df_subset["current_company_name_clean"].fillna("").astype(str).str.strip()
    _bad_employer_tok = _emp_raw.str.upper().isin(_BAD_PLACEHOLDER_EMPLOYER_TOKENS)
    _emp_norm = _emp_raw.mask(_bad_employer_tok, "")
    _treemap = pd.DataFrame(
        {
            "residence_panel": residence_panel,
            "industry_bucket": df_subset["industry_bucket"],
            "industry_segment": df_subset["industry_segment"],
            "employer": _emp_norm,
            "education": _bgu_company_education_field_display(df_subset),
        },
        index=df_subset.index,
    )
    _treemap = _treemap.loc[_treemap["employer"].ne("")].copy()
    if len(_treemap):
        bgu_agg = (
            _treemap.groupby(
                ["residence_panel", "industry_bucket", "industry_segment", "employer", "education"],
                dropna=False,
            )
            .size()
            .reset_index(name="n")
        )
        bgu_agg = bgu_agg.loc[bgu_agg["n"].ge(1)].copy()
        bgu_agg["n"] = bgu_agg["n"].astype(int)
        bgu_agg = bgu_agg.sort_values(
            ["residence_panel", "n", "employer", "education", "industry_bucket", "industry_segment"],
            ascending=[True, False, True, True, True, True],
            kind="stable",
        ).reset_index(drop=True)
    else:
        bgu_agg = pd.DataFrame(
            {
                "residence_panel": pd.Series(dtype=object),
                "industry_bucket": pd.Series(dtype=object),
                "industry_segment": pd.Series(dtype=object),
                "employer": pd.Series(dtype=object),
                "education": pd.Series(dtype=object),
                "n": pd.Series(dtype="int64"),
            }
        )
    return bgu_agg


def build_bs_workers_treemap(df_bgu: pd.DataFrame) -> pd.DataFrame:
    df_bs = df_bgu.loc[df_bgu["works_in_beer_sheva"].fillna(False)].copy()
    panel = pd.Series("Works in BS", index=df_bs.index)
    return build_bgu_treemap_drilldown_agg(df_bs, panel)
