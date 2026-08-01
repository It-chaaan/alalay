import assert from "node:assert/strict";
import { buildMonthlySpending } from "./analytics.service.js";
import { monthRange, previousMonthRange, todayIso } from "./db.js";

const justAfterMidnightInManila = new Date("2026-07-31T16:30:00.000Z");

assert.equal(todayIso(justAfterMidnightInManila), "2026-08-01");
assert.deepEqual(monthRange(justAfterMidnightInManila), { start: "2026-08-01", end: "2026-08-31" });
assert.deepEqual(previousMonthRange(justAfterMidnightInManila), { start: "2026-07-01", end: "2026-07-31" });

const augustSeries = buildMonthlySpending([], justAfterMidnightInManila);
assert.equal(augustSeries.at(-1)?.month, "Aug");
assert.equal(augustSeries.at(-1)?.current, true);
assert.equal(augustSeries.at(-2)?.current, false);

const septemberSeries = buildMonthlySpending([], new Date("2026-08-31T16:30:00.000Z"));
assert.equal(septemberSeries.at(-1)?.month, "Sep");
assert.equal(septemberSeries.at(-1)?.current, true);
