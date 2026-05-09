export type JobsMirroredEntry = {
  label: string;
  count: number;
};

export type JobsMirroredRow = JobsMirroredEntry & {
  rank: number;
  shareOfSide: number;
};

export type JobsMirroredModel = {
  inboundRows: JobsMirroredRow[];
  outboundRows: JobsMirroredRow[];
  inboundTotalMentions: number;
  outboundTotalMentions: number;
  combinedTotalMentions: number;
  inboundShareOfCombined: number;
  outboundShareOfCombined: number;
  maxVisibleCount: number;
};

export type BuildJobsMirroredModelArgs = {
  inboundEmployers: JobsMirroredEntry[];
  outboundEmployers: JobsMirroredEntry[];
  inboundTotalMentions: number;
  outboundTotalMentions: number;
  topN: number;
};

function buildSideRows(
  entries: JobsMirroredEntry[],
  sideTotal: number,
  topN: number,
): JobsMirroredRow[] {
  return [...entries]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, topN))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      shareOfSide: sideTotal > 0 ? entry.count / sideTotal : 0,
    }));
}

export function buildJobsMirroredModel(
  args: BuildJobsMirroredModelArgs,
): JobsMirroredModel {
  const inboundRows = buildSideRows(
    args.inboundEmployers,
    args.inboundTotalMentions,
    args.topN,
  );
  const outboundRows = buildSideRows(
    args.outboundEmployers,
    args.outboundTotalMentions,
    args.topN,
  );
  const combinedTotalMentions =
    args.inboundTotalMentions + args.outboundTotalMentions;
  const visibleCounts = [...inboundRows, ...outboundRows].map((row) => row.count);

  return {
    inboundRows,
    outboundRows,
    inboundTotalMentions: args.inboundTotalMentions,
    outboundTotalMentions: args.outboundTotalMentions,
    combinedTotalMentions,
    inboundShareOfCombined:
      combinedTotalMentions > 0
        ? args.inboundTotalMentions / combinedTotalMentions
        : 0,
    outboundShareOfCombined:
      combinedTotalMentions > 0
        ? args.outboundTotalMentions / combinedTotalMentions
        : 0,
    maxVisibleCount: visibleCounts.length > 0 ? Math.max(...visibleCounts) : 0,
  };
}
