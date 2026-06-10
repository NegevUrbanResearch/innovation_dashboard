import { parseCohortVennOverlap } from "../../linkedin-charts/csv";
import { fetchDataCsv } from "../../linkedin-charts/load-data";

const COHORT_VENN_FILE = "cohort_venn_overlap.csv";

const ALUMNI_WORKING_SEGMENTS = [
  "bgu_and_worker_not_resident",
  "bgu_resident_and_worker",
] as const;

function sumAlumniWorkingInBs(partitions: { segment: string; count: number }[]): number {
  return partitions
    .filter((p) =>
      (ALUMNI_WORKING_SEGMENTS as readonly string[]).includes(p.segment),
    )
    .reduce((sum, p) => sum + p.count, 0);
}

/** Fetch cohort venn CSV once; return formatted count or null on failure. */
export async function loadQuarterAlumniCount(): Promise<string | null> {
  try {
    const raw = await fetchDataCsv(COHORT_VENN_FILE);
    const model = parseCohortVennOverlap(raw);
    const total = sumAlumniWorkingInBs(model.partitions);
    return total.toLocaleString("en-US");
  } catch {
    return null;
  }
}
