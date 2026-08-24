import assert from "node:assert/strict";
import test from "node:test";
import { resolveAiDateRange } from "./ai.date-range.service.js";

const now = new Date("2026-08-24T04:00:00.000Z"); // Aug 24, 2026 in Asia/Manila

test("resolves this week as Monday through today", () => {
  assert.deepEqual(resolveAiDateRange("How much did I spend this week?", now), {
    start: "2026-08-24", end: "2026-08-24", label: "this week", period: "this_week",
  });
});

test("resolves last week and named months", () => {
  assert.deepEqual(resolveAiDateRange("spending last week", now), {
    start: "2026-08-17", end: "2026-08-23", label: "last week", period: "last_week",
  });
  assert.deepEqual(resolveAiDateRange("spending in July 2026", now), {
    start: "2026-07-01", end: "2026-07-31", label: "2026-07", period: "month",
  });
});

test("resolves custom date ranges", () => {
  assert.deepEqual(resolveAiDateRange("from 2026-08-01 to 2026-08-10", now), {
    start: "2026-08-01", end: "2026-08-10", label: "2026-08-01 to 2026-08-10", period: "custom",
  });
});
