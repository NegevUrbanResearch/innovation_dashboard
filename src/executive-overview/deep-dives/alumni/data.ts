import {
  parseBguTreemapDrilldown,
  parseCohortVennOverlap,
  parseEducationFieldGraduationMeta,
  parseEducationFieldGraduationYear,
  parseKeyValueCsv,
  type BguTreemapRow,
  type CohortVennModel,
  type EducationFieldGraduationMeta,
  type EducationFieldGraduationRow,
} from "../../../alumni-charts/csv.ts";
import { alumniDataUrl, fetchAlumniDataCsv } from "../../../alumni-charts/load-data.ts";

export type AlumniDeepDiveData = {
  cohortVenn: CohortVennModel;
  treemapAllBgu: BguTreemapRow[];
  treemapBsWorkers: BguTreemapRow[];
  graduationFieldYear: EducationFieldGraduationRow[];
  graduationMeta: EducationFieldGraduationMeta | null;
  feederCities: { city: string; count: number }[];
  cityCentroids: Record<string, [number, number]>;
};

let cache: Promise<AlumniDeepDiveData | null> | null = null;

export function loadAlumniDeepDiveData(): Promise<AlumniDeepDiveData | null> {
  if (!cache) {
    cache = (async () => {
      try {
        const [vennRaw, treemapAllRaw, treemapBsRaw, gradRaw, feederRaw, centroidsRes] =
          await Promise.all([
            fetchAlumniDataCsv("cohort_venn_overlap.csv"),
            fetchAlumniDataCsv("bgu_treemap_drilldown_agg.csv"),
            fetchAlumniDataCsv("bgu_treemap_drilldown_agg_bs_workers.csv"),
            fetchAlumniDataCsv("education_field_by_graduation_year_bs_workers.csv"),
            fetchAlumniDataCsv("feeder_cities.csv"),
            fetch(alumniDataUrl("city-centroids.json")),
          ]);
        if (!centroidsRes.ok) return null;
        const cityCentroids = (await centroidsRes.json()) as Record<string, [number, number]>;
        const feederCities = [...parseKeyValueCsv(feederRaw).entries()].map(([city, count]) => ({
          city,
          count,
        }));
        return {
          cohortVenn: parseCohortVennOverlap(vennRaw),
          treemapAllBgu: parseBguTreemapDrilldown(treemapAllRaw),
          treemapBsWorkers: parseBguTreemapDrilldown(treemapBsRaw),
          graduationFieldYear: parseEducationFieldGraduationYear(gradRaw),
          graduationMeta: parseEducationFieldGraduationMeta(gradRaw),
          feederCities,
          cityCentroids,
        };
      } catch {
        return null;
      }
    })();
  }
  return cache;
}
