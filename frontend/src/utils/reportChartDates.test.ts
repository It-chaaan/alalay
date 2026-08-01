import assert from "node:assert/strict";
import { buildReportDateTicks, reportDateRatio } from "./reportChartDates";

assert.deepEqual(buildReportDateTicks("2026-08-01", "2026-08-31"), ["2026-08-01", "2026-08-16", "2026-08-31"]);
assert.deepEqual(buildReportDateTicks("2026-08-01", "2026-08-01"), ["2026-08-01"]);
assert.equal(reportDateRatio("2026-08-01", "2026-08-01", "2026-08-31"), 0);
assert.equal(reportDateRatio("2026-08-31", "2026-08-01", "2026-08-31"), 1);
assert.equal(reportDateRatio("2026-08-16", "2026-08-01", "2026-08-31") > 0.4, true);

for (const [start, end] of [
  ["2026-08-01", "2026-08-31"],
  ["2026-07-01", "2026-07-31"],
  ["2026-06-01", "2026-08-31"],
  ["2026-07-01", "2026-09-30"],
  ["2026-01-01", "2026-08-31"],
  ["2026-08-03", "2026-08-12"],
] as const) {
  const ticks = buildReportDateTicks(start, end);
  assert.equal(new Set(ticks).size, ticks.length);
  assert.equal(ticks.every((tick, index) => index === 0 || tick > ticks[index - 1]), true);
}

console.log("report chart date tests passed");
