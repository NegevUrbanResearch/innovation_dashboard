import test from "node:test";
import assert from "node:assert/strict";

import { buildJobsMirroredModel } from "./jobs-mirrored-model.ts";

test("buildJobsMirroredModel keeps inbound and outbound rankings independent", () => {
  const model = buildJobsMirroredModel({
    inboundEmployers: [
      { label: "BGU", count: 12 },
      { label: "Soroka", count: 30 },
      { label: "ICL", count: 9 },
      { label: "Axxon", count: 16 },
    ],
    outboundEmployers: [
      { label: "Intel", count: 18 },
      { label: "Amdocs", count: 10 },
      { label: "Apple", count: 11 },
      { label: "NICE", count: 8 },
    ],
    inboundTotalMentions: 100,
    outboundTotalMentions: 80,
    topN: 3,
  });

  assert.deepEqual(
    model.inboundRows.map((row) => [row.rank, row.label, row.count]),
    [
      [1, "Soroka", 30],
      [2, "Axxon", 16],
      [3, "BGU", 12],
    ],
  );
  assert.deepEqual(
    model.outboundRows.map((row) => [row.rank, row.label, row.count]),
    [
      [1, "Intel", 18],
      [2, "Apple", 11],
      [3, "Amdocs", 10],
    ],
  );
});

test("buildJobsMirroredModel computes side and combined shares from full totals", () => {
  const model = buildJobsMirroredModel({
    inboundEmployers: [
      { label: "BGU", count: 12 },
      { label: "Soroka", count: 30 },
      { label: "ICL", count: 9 },
    ],
    outboundEmployers: [
      { label: "Intel", count: 18 },
      { label: "Amdocs", count: 10 },
      { label: "Apple", count: 11 },
    ],
    inboundTotalMentions: 100,
    outboundTotalMentions: 50,
    topN: 2,
  });

  assert.equal(model.inboundTotalMentions, 100);
  assert.equal(model.outboundTotalMentions, 50);
  assert.equal(model.combinedTotalMentions, 150);
  assert.equal(model.maxVisibleCount, 30);
  assert.equal(model.inboundShareOfCombined, 100 / 150);
  assert.equal(model.outboundShareOfCombined, 50 / 150);
  assert.deepEqual(
    model.inboundRows.map((row) => [row.label, row.shareOfSide]),
    [
      ["Soroka", 0.3],
      ["BGU", 0.12],
    ],
  );
  assert.deepEqual(
    model.outboundRows.map((row) => [row.label, row.shareOfSide]),
    [
      ["Intel", 0.36],
      ["Apple", 0.22],
    ],
  );
});

test("buildJobsMirroredModel handles empty totals without NaN shares", () => {
  const model = buildJobsMirroredModel({
    inboundEmployers: [{ label: "BGU", count: 0 }],
    outboundEmployers: [],
    inboundTotalMentions: 0,
    outboundTotalMentions: 0,
    topN: 5,
  });

  assert.equal(model.combinedTotalMentions, 0);
  assert.equal(model.inboundShareOfCombined, 0);
  assert.equal(model.outboundShareOfCombined, 0);
  assert.equal(model.maxVisibleCount, 0);
  assert.deepEqual(model.inboundRows, [
    { rank: 1, label: "BGU", count: 0, shareOfSide: 0 },
  ]);
  assert.deepEqual(model.outboundRows, []);
});
