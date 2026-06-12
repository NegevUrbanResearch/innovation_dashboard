export const ALUMNI_PUBLIC_DATA_DIR = "alumni";

export function alumniDataUrl(name: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${ALUMNI_PUBLIC_DATA_DIR}/${name}`;
}

export async function fetchAlumniDataCsv(name: string): Promise<string> {
  const res = await fetch(alumniDataUrl(name), { cache: "default" });
  if (!res.ok) {
    throw new Error(`Failed to load ${ALUMNI_PUBLIC_DATA_DIR}/${name} (${res.status})`);
  }
  return res.text();
}

/** @deprecated use fetchAlumniDataCsv */
export const fetchDataCsv = fetchAlumniDataCsv;
