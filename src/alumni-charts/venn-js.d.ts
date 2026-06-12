declare module "venn.js" {
  export type VennArea = { sets: string[]; size: number };

  export function venn(
    areas: VennArea[],
    parameters?: Record<string, unknown>,
  ): Record<string, { x: number; y: number; radius: number }>;

  export function normalizeSolution(
    solution: Record<string, { x: number; y: number; radius: number }>,
    orientation: number | null,
    orientationOrder: ((a: unknown, b: unknown) => number) | null,
  ): Record<string, { x: number; y: number; radius: number; setid?: string }>;

  export function scaleSolution(
    solution: Record<string, { x: number; y: number; radius: number }>,
    width: number,
    height: number,
    padding: number,
  ): Record<string, { x: number; y: number; radius: number }>;

  export function circlePath(x: number, y: number, r: number): string;

  export function intersectionAreaPath(
    circles: { x: number; y: number; radius: number }[],
  ): string;

  export function computeTextCentres(
    circles: Record<string, { x: number; y: number; radius: number }>,
    areas: VennArea[],
  ): Record<string, { x: number; y: number; disjoint?: boolean }>;
}
