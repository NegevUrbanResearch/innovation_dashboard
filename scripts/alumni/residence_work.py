#!/usr/bin/env python3
from __future__ import annotations

import re

import numpy as np
import pandas as pd

from alumni.paths import TAXONOMY_DIR


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


def _known_pct(n_total: int, n_known: int) -> float:
    return round(100.0 * n_known / n_total, 1) if n_total else 0.0


def _attach_quality_denominators(out: pd.DataFrame, n_total: int, n_known: int) -> pd.DataFrame:
    frame = out.copy()
    frame["n_total"] = n_total
    frame["n_known"] = n_known
    frame["known_pct"] = _known_pct(n_total, n_known)
    return frame


def _stem_degree_line(bucket: pd.Series) -> pd.Series:
    b = bucket.astype(str).str.lower()
    line = pd.Series("other", index=bucket.index, dtype=object)
    line[b.isin(["stem", "medical"])] = "stem"
    line[b.eq("non_stem")] = "non_stem"
    return line


# Labels emitted by education_category6 taxonomy CSV + classifier (lowercased for lookup).
_STEM_LINE_STEM_CATEGORIES = frozenset({"stem_sciences", "medical"})
_STEM_LINE_NON_STEM_CATEGORIES = frozenset(
    {"business_economics", "professional_other", "social_humanities", "arts_humanities"}
)


def derive_stem_degree_line(df: pd.DataFrame) -> pd.Series:
    """
    Stakeholder STEM line for Q2-style summaries: prefer structured ``education_category_6``,
    then fall back to legacy ``education_bucket`` (same mapping as :func:`_stem_degree_line`).
    If ``education_category_6`` is absent (older exports), only the legacy mapping is used.
    """
    if "education_category_6" not in df.columns:
        return _stem_degree_line(df["education_bucket"])
    cat = df["education_category_6"].fillna("").astype(str).str.strip().str.lower()
    out = pd.Series("other", index=df.index, dtype=object)
    stem_mask = cat.isin(_STEM_LINE_STEM_CATEGORIES)
    non_stem_mask = cat.isin(_STEM_LINE_NON_STEM_CATEGORIES)
    out.loc[stem_mask] = "stem"
    out.loc[non_stem_mask] = "non_stem"
    fallback_mask = ~(stem_mask | non_stem_mask)
    if fallback_mask.any():
        out.loc[fallback_mask] = _stem_degree_line(df.loc[fallback_mask, "education_bucket"]).values
    return out


def _worked_during_label(series: pd.Series) -> pd.Series:
    out = pd.Series("NA", index=series.index, dtype=object)
    ok = series.notna()
    out.loc[ok & series.eq(True)] = "True"
    out.loc[ok & series.eq(False)] = "False"
    return out


def _bgu_education_detail_known(cohort: pd.DataFrame) -> pd.Series:
    bad_bucket = cohort["bgu_education_bucket"].isin(["no_education", "unspecified"])
    bad_level = cohort["bgu_highest_degree_level"].isin(["no_education", "unspecified"])
    return ~(bad_bucket | bad_level)


def _work_stay_overlap_full_grid(counts: pd.Series) -> pd.DataFrame:
    """Ensure work-during-studies × stay_in_bs lists True/False/NA × stay_in_bs with explicit zero counts."""
    full_idx = pd.MultiIndex.from_product(
        [["True", "False", "NA"], [False, True]],
        names=["worked_during_studies_label", "stay_in_bs"],
    )
    aligned = counts.reindex(full_idx, fill_value=0)
    # reindex coerces to float for missing; counts are integers
    aligned = aligned.astype(int)
    return aligned.reset_index(name="count")


def _bgu_ever_worked_bs_summary(df: pd.DataFrame) -> pd.DataFrame:
    cohort = df.loc[df["is_bgu_grad"].fillna(False)].copy()
    n_total = int(len(cohort))
    if "ever_worked_in_beer_sheva_known" in cohort.columns:
        known = cohort["ever_worked_in_beer_sheva_known"].fillna(False)
    else:
        # Backward compatibility for older cleaned exports.
        known = cohort["ever_worked_in_beer_sheva"].notna()
    ever = cohort["ever_worked_in_beer_sheva"]
    n_known_experience = int(known.sum())
    n_ever = int(ever.eq(True).sum())
    n_never = int((known & ever.eq(False)).sum())
    n_unknown_work_history = int((~known).sum())
    pct = (n_ever / n_total * 100.0) if n_total else 0.0
    return pd.DataFrame(
        [
            {
                "cohort": "bgu_graduates",
                "n_total": n_total,
                "n_known_experience": n_known_experience,
                "n_never_worked_bs": n_never,
                "n_unknown_work_history": n_unknown_work_history,
                "n_ever_worked_bs": n_ever,
                "pct_ever_worked_bs": round(pct, 2),
            }
        ]
    )


def _bgu_ever_bs_worked_during_overlap(df: pd.DataFrame) -> pd.DataFrame:
    """BGU cohort: overlap of ever-worked-BS vs worked-during-studies among rows known on both dimensions."""
    cohort = df.loc[df["is_bgu_grad"].fillna(False)]
    n_total = int(len(cohort))
    if "ever_worked_in_beer_sheva_known" in cohort.columns:
        known_ever = cohort["ever_worked_in_beer_sheva_known"].fillna(False)
    else:
        known_ever = cohort["ever_worked_in_beer_sheva"].notna()
    mask = known_ever & cohort["worked_during_studies_known"].fillna(False)
    sub = cohort.loc[mask]
    n_known_both = int(len(sub))
    if n_known_both == 0:
        return pd.DataFrame(
            [
                {
                    "cohort": "bgu_graduates",
                    "n_total": n_total,
                    "n_known_both": 0,
                    "n_ever_bs_only": 0,
                    "n_during_studies_only": 0,
                    "n_ever_bs_and_during": 0,
                    "n_neither": 0,
                }
            ]
        )
    ever = sub["ever_worked_in_beer_sheva"].eq(True)
    during = sub["worked_during_studies"].eq(True)
    n_both = int((ever & during).sum())
    n_e_only = int((ever & ~during).sum())
    n_d_only = int((~ever & during).sum())
    n_neither = int((~ever & ~during).sum())
    return pd.DataFrame(
        [
            {
                "cohort": "bgu_graduates",
                "n_total": n_total,
                "n_known_both": n_known_both,
                "n_ever_bs_only": n_e_only,
                "n_during_studies_only": n_d_only,
                "n_ever_bs_and_during": n_both,
                "n_neither": n_neither,
            }
        ]
    )


def _bgu_worked_during_studies_summary(df: pd.DataFrame) -> pd.DataFrame:
    cohort = df.loc[df["is_bgu_grad"].fillna(False)].copy()
    n_total = int(len(cohort))
    known_mask = cohort["worked_during_studies_known"].fillna(False)
    n_overlap_known = int(known_mask.sum())

    worked = cohort["worked_during_studies"]
    n_true = int(worked.eq(True).sum())
    n_false = int(worked.eq(False).sum())
    n_na = int(worked.isna().sum())
    pct_known = (n_true / n_overlap_known * 100.0) if n_overlap_known else 0.0

    worked_bs = cohort["worked_in_beer_sheva_during_studies"]
    n_bs_true = int(worked_bs.eq(True).sum())
    pct_bs = (n_bs_true / n_overlap_known * 100.0) if n_overlap_known else 0.0

    return pd.DataFrame(
        [
            {
                "cohort": "bgu_graduates",
                "n_total": n_total,
                "n_overlap_known": n_overlap_known,
                "n_worked_true": n_true,
                "n_worked_false": n_false,
                "n_worked_na": n_na,
                "pct_worked_among_known": round(pct_known, 2),
                "n_worked_bs_during_true": n_bs_true,
                "pct_worked_bs_during_among_known": round(pct_bs, 2),
            }
        ]
    )


def add_quality_analysis_tables(df: pd.DataFrame, results: dict) -> None:
    """Quality-aware breakdown tables plus a coverage summary.

    Education-oriented tables use the **BGU graduates** subset ``df[df["is_bgu_grad"]]``.
    This includes chart-16 / chart-18 source tables (legacy/profile-global and
    BGU-attributed detailed views).
    """
    coverage_rows: list[dict[str, object]] = []
    df_bgu = df.loc[df["is_bgu_grad"]].copy()
    n_bgu_total = len(df_bgu)

    # BGU alumni: BGU degree level × BGU education bucket
    cohort_bgu = df_bgu
    n_total_bgu = len(cohort_bgu)
    known_mask_bgu_detail = _bgu_education_detail_known(cohort_bgu)
    n_known_bgu = int(known_mask_bgu_detail.sum())
    if n_total_bgu:
        tbl_bgu_bs = (
            cohort_bgu.groupby(["bgu_highest_degree_level", "bgu_education_bucket"], dropna=False)
            .size()
            .reset_index(name="count")
        )
    else:
        tbl_bgu_bs = pd.DataFrame(columns=["bgu_highest_degree_level", "bgu_education_bucket", "count"])
    results["bgu_bs_residents_education_detailed"] = _attach_quality_denominators(tbl_bgu_bs, n_total_bgu, n_known_bgu)
    coverage_rows.append(
        {
            "table_key": "bgu_bs_residents_education_detailed",
            "n_total": n_total_bgu,
            "n_known": n_known_bgu,
            "known_pct": _known_pct(n_total_bgu, n_known_bgu),
            "denominator_note": "Cohort: BGU graduates. Known: classified BGU bucket and degree level.",
        }
    )

    # STEM line by education end year (BGU graduates with a parsed end year)
    n_total_profile = n_bgu_total
    df_with_edu_end = df_bgu.loc[df_bgu["education_end_year"].notna()].copy()
    n_known_edu_end = len(df_with_edu_end)
    if n_known_edu_end:
        df_with_edu_end["education_end_year_int"] = df_with_edu_end["education_end_year"].astype(int)
        df_with_edu_end["stem_degree_line"] = derive_stem_degree_line(df_with_edu_end)
        tbl_stem_by_year = (
            df_with_edu_end.groupby(["education_end_year_int", "stem_degree_line"], dropna=False)
            .size()
            .reset_index(name="count")
            .rename(columns={"education_end_year_int": "education_end_year"})
        )
    else:
        tbl_stem_by_year = pd.DataFrame(columns=["education_end_year", "stem_degree_line", "count"])
    results["stem_degree_by_edu_end_year"] = _attach_quality_denominators(
        tbl_stem_by_year, n_total_profile, n_known_edu_end
    )
    coverage_rows.append(
        {
            "table_key": "stem_degree_by_edu_end_year",
            "n_total": n_total_profile,
            "n_known": n_known_edu_end,
            "known_pct": _known_pct(n_total_profile, n_known_edu_end),
            "denominator_note": "Cohort: BGU graduates. Known: rows with non-null education_end_year.",
        }
    )

    # education_bucket × stay_in_bs (residence_bucket == beer_sheva)
    n_total_profile = n_bgu_total
    n_known_residence = int(df_bgu["has_known_residence"].sum())
    df_stay_bs = df_bgu.assign(stay_in_bs=df_bgu["residence_bucket"].eq("beer_sheva"))
    tbl_edu_stay_bs = df_stay_bs.groupby(["education_bucket", "stay_in_bs"], dropna=False).size().reset_index(name="count")
    results["education_vs_stay_bs"] = _attach_quality_denominators(
        tbl_edu_stay_bs, n_total_profile, n_known_residence
    )
    coverage_rows.append(
        {
            "table_key": "education_vs_stay_bs",
            "n_total": n_total_profile,
            "n_known": n_known_residence,
            "known_pct": _known_pct(n_total_profile, n_known_residence),
            "denominator_note": "Cohort: BGU graduates. Known: coarse residence resolved (not unknown).",
        }
    )

    # education_bucket × stay_in_country
    n_total_profile = n_bgu_total
    n_known_residence = int(df_bgu["has_known_residence"].sum())
    df_stay_country = df_bgu.assign(stay_in_country=df_bgu["residence_bucket"].isin(["beer_sheva", "israel_other"]))
    tbl_edu_stay_country = df_stay_country.groupby(["education_bucket", "stay_in_country"], dropna=False).size().reset_index(name="count")
    results["education_vs_stay_country"] = _attach_quality_denominators(
        tbl_edu_stay_country, n_total_profile, n_known_residence
    )
    coverage_rows.append(
        {
            "table_key": "education_vs_stay_country",
            "n_total": n_total_profile,
            "n_known": n_known_residence,
            "known_pct": _known_pct(n_total_profile, n_known_residence),
            "denominator_note": "Cohort: BGU graduates. Known: coarse residence resolved (not unknown).",
        }
    )

    # worked_during_studies (tri-state) × stay_in_bs (BGU graduates)
    n_total_profile = n_bgu_total
    n_known_work_res = int((df_bgu["worked_during_studies_known"] & df_bgu["has_known_residence"]).sum())
    df_work_stay = df_bgu.assign(
        stay_in_bs=df_bgu["residence_bucket"].eq("beer_sheva"),
        worked_during_studies_label=_worked_during_label(df_bgu["worked_during_studies"]),
    )
    work_stay_counts = df_work_stay.groupby(["worked_during_studies_label", "stay_in_bs"], dropna=False).size()
    tbl_work_stay = _work_stay_overlap_full_grid(work_stay_counts)
    results["work_during_studies_vs_stay_bs"] = _attach_quality_denominators(
        tbl_work_stay, n_total_profile, n_known_work_res
    )
    coverage_rows.append(
        {
            "table_key": "work_during_studies_vs_stay_bs",
            "n_total": n_total_profile,
            "n_known": n_known_work_res,
            "known_pct": _known_pct(n_total_profile, n_known_work_res),
            "denominator_note": "Cohort: BGU graduates. Known: overlap classification known and coarse residence resolved.",
        }
    )

    # Fine taxonomy field (beyond legacy stem / non_stem bucket), BGU graduates only
    n_total_profile = n_bgu_total
    if "education_field_fine" in df_bgu.columns:
        known_field_mask = df_bgu["education_field_fine"].fillna("").astype(str).str.strip().ne("")
        n_known_field = int(known_field_mask.sum())
        if n_known_field:
            sub = df_bgu.loc[known_field_mask].copy()
            line = derive_stem_degree_line(sub)
            # Two presentation panels (STEM vs non-STEM): collapse Q2 "other" into non-STEM.
            sub["field_stem_line"] = line.where(line.eq("stem"), "non_stem")
            tbl_fields = (
                sub.groupby(["education_field_fine", "field_stem_line"], dropna=False)
                .size()
                .reset_index(name="count")
            )
        else:
            tbl_fields = pd.DataFrame(columns=["education_field_fine", "field_stem_line", "count"])
    else:
        n_known_field = 0
        tbl_fields = pd.DataFrame(columns=["education_field_fine", "field_stem_line", "count"])
    results["education_fields_detailed"] = _attach_quality_denominators(
        tbl_fields, n_total_profile, n_known_field
    )
    coverage_rows.append(
        {
            "table_key": "education_fields_detailed",
            "n_total": n_total_profile,
            "n_known": n_known_field,
            "known_pct": _known_pct(n_total_profile, n_known_field),
            "denominator_note": "Cohort: BGU graduates. Known: non-empty education_field_fine (trimmed).",
        }
    )

    results["quality_coverage_by_table"] = pd.DataFrame(coverage_rows)


_MUNICIPALITY_ENGINEER_DOMAINS = frozenset({"software", "hardware", "mechanics", "electronics"})
_ACTIVE_ENGINEERING_TITLE_RE = re.compile(
    r"(?:engineer|developer|architect|hardware|mechanical|electrical|electronics)",
    re.IGNORECASE,
)
_COMMUTE_RING_LOCALITIES_PATH = TAXONOMY_DIR / "municipality_commute_ring_localities.csv"
_MUNICIPALITY_TABLE_COLUMNS = frozenset(
    {
        "lives_in_beer_sheva",
        "works_in_beer_sheva",
        "residence_city",
        "work_city",
        "municipality_engineer_domain",
        "current_title",
        "job_family",
        "senior_5y_engineering_status",
        "senior_5y_status",
        "has_specific_residence",
        "city",
        "location",
    }
)

_MUNICIPALITY_RESIDENCE_DISCLOSURE_COLUMNS = [
    "cohort_key",
    "cohort_label",
    "n_total",
    "valid_specific_city_n",
    "generic_or_unvalidated_text_n",
    "blank_or_missing_geo_n",
    "valid_specific_city_pct",
    "generic_or_unvalidated_text_pct",
    "blank_or_missing_geo_pct",
]


def _municipality_tables_ready(df: pd.DataFrame) -> bool:
    return _MUNICIPALITY_TABLE_COLUMNS.issubset(df.columns)


def _empty_municipality_senior_engineer_tables() -> dict[str, pd.DataFrame]:
    return {
        "municipality_senior_engineer_overview": pd.DataFrame(
            columns=[
                "n_scoped_profiles",
                "n_target_domain_engineers",
                "n_engineer_senior_5y_total",
                "n_engineer_not_senior_5y_total",
                "n_engineer_senior_5y_unknown",
                "n_engineer_senior_5y_totalcareer",
                "pct_senior_among_engineering_5y_known",
            ]
        ),
        "municipality_residence_disclosure_summary": pd.DataFrame(
            columns=_MUNICIPALITY_RESIDENCE_DISCLOSURE_COLUMNS
        ),
    }


def _load_commute_ring_localities() -> set[str]:
    s = pd.read_csv(_COMMUTE_RING_LOCALITIES_PATH)["city"].dropna().astype(str).str.strip()
    return {v for v in s if v}


def municipality_scope_mask(df: pd.DataFrame) -> pd.Series:
    commute_ring = _load_commute_ring_localities()
    return (
        df["lives_in_beer_sheva"].fillna(False)
        | df["works_in_beer_sheva"].fillna(False)
        | df["residence_city"].fillna("").isin(commute_ring)
        | df["work_city"].fillna("").isin(commute_ring)
    )


def _municipality_active_engineer_mask(scoped: pd.DataFrame) -> pd.Series:
    active_engineering_title = scoped["current_title"].fillna("").str.contains(
        _ACTIVE_ENGINEERING_TITLE_RE, regex=True
    )
    return scoped["municipality_engineer_domain"].isin(_MUNICIPALITY_ENGINEER_DOMAINS) & (
        scoped["job_family"].eq("engineering") | active_engineering_title
    )


def _municipality_residence_disclosure_bucket(df: pd.DataFrame) -> pd.Series:
    city_text = df.get("city", pd.Series("", index=df.index)).fillna("").astype(str).str.strip()
    location_text = df.get("location", pd.Series("", index=df.index)).fillna("").astype(str).str.strip()
    has_any_geo_text = city_text.ne("") | location_text.ne("")
    return pd.Series(
        np.select(
            [
                df["has_specific_residence"].fillna(False),
                has_any_geo_text,
            ],
            [
                "valid_specific_city",
                "generic_or_unvalidated_text",
            ],
            default="blank_or_missing_geo",
        ),
        index=df.index,
    )


def municipality_residence_disclosure_summary(df: pd.DataFrame) -> pd.DataFrame:
    full = df.copy()
    full_eng = full.loc[_municipality_active_engineer_mask(full)].copy()
    scoped = full.loc[municipality_scope_mask(full)].copy()
    active_eng = scoped.loc[_municipality_active_engineer_mask(scoped)].copy()
    cohorts = [
        ("full_db_all", "Full database: all profiles", full),
        (
            "full_db_4field_engineers_all",
            "Full database: 4-field engineers",
            full_eng,
        ),
        (
            "full_db_4field_engineers_senior",
            "Full database: 4-field engineering seniors",
            full_eng.loc[full_eng["senior_5y_engineering_status"].eq("senior")],
        ),
        ("target_domain_engineers_all", "BS / commute-ring scope: 4-field engineers", active_eng),
        (
            "target_domain_engineers_senior",
            "BS / commute-ring scope: 4-field engineering seniors",
            active_eng.loc[active_eng["senior_5y_engineering_status"].eq("senior")],
        ),
    ]
    rows = []
    for cohort_key, cohort_label, frame in cohorts:
        bucket = _municipality_residence_disclosure_bucket(frame)
        counts = bucket.value_counts().to_dict()
        total = int(len(frame))
        valid = int(counts.get("valid_specific_city", 0))
        generic = int(counts.get("generic_or_unvalidated_text", 0))
        blank = int(counts.get("blank_or_missing_geo", 0))
        rows.append(
            {
                "cohort_key": cohort_key,
                "cohort_label": cohort_label,
                "n_total": total,
                "valid_specific_city_n": valid,
                "generic_or_unvalidated_text_n": generic,
                "blank_or_missing_geo_n": blank,
                "valid_specific_city_pct": _known_pct(total, valid),
                "generic_or_unvalidated_text_pct": _known_pct(total, generic),
                "blank_or_missing_geo_pct": _known_pct(total, blank),
            }
        )
    return pd.DataFrame(rows, columns=_MUNICIPALITY_RESIDENCE_DISCLOSURE_COLUMNS)


def municipality_senior_engineer_overview(df: pd.DataFrame) -> pd.DataFrame:
    scoped = df.loc[municipality_scope_mask(df)].copy()
    eng = scoped.loc[_municipality_active_engineer_mask(scoped)]
    n_senior = int(eng["senior_5y_engineering_status"].eq("senior").sum())
    n_not_senior = int(eng["senior_5y_engineering_status"].eq("not_senior").sum())
    n_unknown = int(eng["senior_5y_engineering_status"].eq("unknown").sum())
    return pd.DataFrame(
        [
            {
                "n_scoped_profiles": int(len(scoped)),
                "n_target_domain_engineers": int(len(eng)),
                "n_engineer_senior_5y_total": n_senior,
                "n_engineer_not_senior_5y_total": n_not_senior,
                "n_engineer_senior_5y_unknown": n_unknown,
                "n_engineer_senior_5y_totalcareer": int(eng["senior_5y_status"].eq("senior").sum()),
                "pct_senior_among_engineering_5y_known": round(
                    100.0 * n_senior / max(1, (n_senior + n_not_senior)), 2
                ),
            }
        ]
    )


def add_municipality_senior_engineer_tables(df: pd.DataFrame, results: dict[str, pd.DataFrame]) -> None:
    if not _municipality_tables_ready(df):
        results.update(_empty_municipality_senior_engineer_tables())
        return

    results["municipality_senior_engineer_overview"] = municipality_senior_engineer_overview(df)
    results["municipality_residence_disclosure_summary"] = municipality_residence_disclosure_summary(df)


def add_question_analysis_tables(df: pd.DataFrame, results: dict) -> None:
    """Attach result tables for the A-F questions (full cohort, not analytic-only).

    Education-facing summaries (STEM mix, education × residence, tenure by education)
    are restricted to **BGU graduates**; mobility / job tables stay on the full cohort, with
    added BGU-only industry × Beer-Sheva residence and employer count tables.
    """
    df_bgu = df.loc[df["is_bgu_grad"]]
    results["bs_residents_bgu_education"] = (
        df_bgu.groupby(["highest_degree_level", "education_bucket"], dropna=False).size().sort_values(ascending=False)
    )
    results["stem_non_stem_overall"] = df_bgu["education_bucket"].value_counts(dropna=False)
    results["education_vs_retention"] = pd.crosstab(df_bgu["education_bucket"], df_bgu["residence_bucket"])
    residence_map = df["lives_in_beer_sheva"].map({True: "Lives in BS", False: "Lives outside BS"})
    bgu_residence_map = df_bgu["lives_in_beer_sheva"].map(
        {True: "Lives in BS", False: "Lives outside BS"}
    )

    results["job_types_in_bs"] = df.loc[df["works_in_beer_sheva"], "industry_segment"].value_counts(
        dropna=False
    )
    _residence_cols = ("Lives in BS", "Lives outside BS")
    results["job_type_vs_residence"] = (
        pd.crosstab(df["industry_segment"], residence_map).reindex(columns=list(_residence_cols), fill_value=0).copy()
    )
    results["bgu_job_type_vs_residence"] = (
        pd.crosstab(df_bgu["industry_bucket"], bgu_residence_map)
        .reindex(columns=list(_residence_cols), fill_value=0)
        .copy()
    )

    # Canonical BGU drilldown: bucket → segment → employer → education × residence (rows with blank employer omitted).
    _emp_raw = df_bgu["current_company_name_clean"].fillna("").astype(str).str.strip()
    _bad_employer_tok = _emp_raw.str.upper().isin(_BAD_PLACEHOLDER_EMPLOYER_TOKENS)
    _emp_norm = _emp_raw.mask(_bad_employer_tok, "")
    _treemap = pd.DataFrame(
        {
            "residence_panel": bgu_residence_map,
            "industry_bucket": df_bgu["industry_bucket"],
            "industry_segment": df_bgu["industry_segment"],
            "employer": _emp_norm,
            "education": _bgu_company_education_field_display(df_bgu),
        },
        index=df_bgu.index,
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
    results["bgu_treemap_drilldown_agg"] = bgu_agg
    results["tenure_by_groups"] = (
        df_bgu.groupby(["education_bucket", "lives_in_beer_sheva"], dropna=False)["tenure_months_current_role"]
        .mean()
        .round(2)
    )
    add_quality_analysis_tables(df, results)


def analyze_residence_work(df: pd.DataFrame) -> dict:
    total = len(df)
    has_both = df["has_specific_residence"] & df["has_specific_work"]
    analytic = df[has_both].copy()
    n_analytic = len(analytic)
    n_dropped = total - n_analytic

    print("\n  Residence x Work Analysis (bias-aware)")
    print(f"  Total: {total:,}  |  Both cities known: {n_analytic:,} ({100 * n_analytic / total:.1f}%)")

    results = {
        "filter_stats": pd.Series(
            {
                "total_rows": total,
                "has_specific_residence": int(df["has_specific_residence"].sum()),
                "has_specific_work": int(df["has_specific_work"].sum()),
                "analytic_sample": n_analytic,
                "dropped": n_dropped,
                "analytic_pct": round(100 * n_analytic / total, 1) if total else 0,
            }
        )
    }

    add_question_analysis_tables(df, results)
    add_municipality_senior_engineer_tables(df, results)

    results["bgu_ever_worked_beer_sheva_summary"] = _bgu_ever_worked_bs_summary(df)
    results["bgu_worked_during_studies_summary"] = _bgu_worked_during_studies_summary(df)
    results["bgu_ever_bs_worked_during_overlap"] = _bgu_ever_bs_worked_during_overlap(df)

    if n_analytic == 0:
        print("  WARNING: No rows with both specific residence and work city.")
        return results

    ct = pd.crosstab(
        analytic["lives_in_beer_sheva"].map({True: "Lives in BS", False: "Lives outside BS"}),
        analytic["works_in_beer_sheva"].map({True: "Works in BS", False: "Works outside BS"}),
    )
    results["crosstab"] = ct

    bs_residents = analytic[analytic["lives_in_beer_sheva"]]
    if len(bs_residents):
        work_bs = bs_residents["works_in_beer_sheva"].sum()
        work_out = len(bs_residents) - work_bs
        results["residents_work"] = pd.Series(
            {
                "Work in Beer Sheva": work_bs / len(bs_residents),
                "Work outside Beer Sheva": work_out / len(bs_residents),
            }
        )
        results["residents_work_n"] = pd.Series(
            {
                "Work in Beer Sheva": int(work_bs),
                "Work outside Beer Sheva": int(work_out),
            }
        )
        print(f"  BS residents (n={len(bs_residents):,}): {100 * work_bs / len(bs_residents):.1f}% work in BS")

    bs_workers = analytic[analytic["works_in_beer_sheva"]]
    if len(bs_workers):
        live_bs = bs_workers["lives_in_beer_sheva"].sum()
        live_out = len(bs_workers) - live_bs
        results["workers_residence"] = pd.Series(
            {
                "Live in Beer Sheva": live_bs / len(bs_workers),
                "Live outside Beer Sheva": live_out / len(bs_workers),
            }
        )
        results["workers_residence_n"] = pd.Series(
            {
                "Live in Beer Sheva": int(live_bs),
                "Live outside Beer Sheva": int(live_out),
            }
        )
        print(f"  BS workers (n={len(bs_workers):,}): {100 * live_bs / len(bs_workers):.1f}% live in BS")

    bgu = analytic[analytic["is_bgu_grad"]]
    if len(bgu):
        bgu_bs = bgu["lives_in_beer_sheva"].sum()
        bgu_il = ((~bgu["lives_in_beer_sheva"]) & (bgu["country_norm"] == "IL")).sum()
        bgu_abroad = (
            (~bgu["lives_in_beer_sheva"]) & (bgu["country_norm"] != "IL") & (bgu["country_norm"] != "")
        ).sum()
        results["bgu_residence"] = pd.Series(
            {
                "Beer Sheva": bgu_bs / len(bgu),
                "Israel (not BS)": bgu_il / len(bgu),
                "Abroad": bgu_abroad / len(bgu),
            }
        )
        results["bgu_residence_n"] = pd.Series(
            {
                "Beer Sheva": int(bgu_bs),
                "Israel (not BS)": int(bgu_il),
                "Abroad": int(bgu_abroad),
            }
        )
        print(f"  BGU grads (n={len(bgu):,}): {100 * bgu_bs / len(bgu):.1f}% in BS")

    commuters = analytic[analytic["works_in_beer_sheva"] & (~analytic["lives_in_beer_sheva"])]
    if len(commuters):
        results["feeder_cities"] = commuters["residence_city"].value_counts()

    outbound = analytic[analytic["lives_in_beer_sheva"] & (~analytic["works_in_beer_sheva"])]
    if len(outbound):
        results["destination_cities"] = outbound["work_city"].value_counts()

    print("\n  Company analysis...")

    def _top_companies(subset: pd.DataFrame, label: str) -> pd.Series | None:
        names = subset["current_company_name_clean"].fillna("").astype(str).str.strip().replace("", pd.NA).dropna()
        if names.empty:
            return None
        counts = names.value_counts()
        print(f"    {label}: {len(subset):,} people, {len(names):,} with company name")
        for company, count in counts.head(5).items():
            print(f"      {company}: {count:,}")
        return counts

    all_bs_workers = df[df["works_in_beer_sheva"]]
    results["companies_in_bs"] = _top_companies(all_bs_workers, "Top employers in Beer Sheva (all BS workers)")
    results["companies_inbound"] = _top_companies(
        commuters, "Employers of inbound commuters (live outside, work in BS)"
    )
    results["companies_outbound"] = _top_companies(
        outbound, "Employers of outbound commuters (live in BS, work outside)"
    )

    suspect_patterns = [
        re.compile(r"ben[- ]?gurion|b\.?g\.?u", re.IGNORECASE),
        re.compile(r"self[- ]?employ", re.IGNORECASE),
    ]
    if len(outbound):
        for pattern in suspect_patterns:
            mask = outbound["current_company_name_clean"].fillna("").str.contains(pattern, na=False)
            suspect = outbound[mask]
            if suspect.empty:
                continue
            label = pattern.pattern[:30]
            print(f"\n    DIAGNOSTIC [{label}] - {len(suspect)} outbound rows:")
            cols = ["current_company_name_clean", "work_location_raw", "work_city", "residence_city", "current_title"]
            cols = [c for c in cols if c in suspect.columns]
            for _, row in suspect.head(20).iterrows():
                parts = []
                for col in cols:
                    value = str(row.get(col, ""))[:60]
                    parts.append(f"{col}={value}")
                print(f"      {' | '.join(parts)}")
            if len(suspect) > 20:
                print(f"      ... and {len(suspect) - 20} more")

    return results
