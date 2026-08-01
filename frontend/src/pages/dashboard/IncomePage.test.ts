import assert from "node:assert/strict";
import type { IncomeEntry } from "../../hooks/types";
import { buildIncomeMonthlySeries } from "../../utils/incomeSeries";

const entries: IncomeEntry[] = [
  { id: "july", source: "Salary", type: "salary", amount: 50000, date: "2026-07-15", is_recurring: true, created_at: "2026-07-15" },
  { id: "august", source: "Freelance", type: "freelance", amount: 12000, date: "2026-08-01", is_recurring: false, created_at: "2026-08-01" },
];

const series = buildIncomeMonthlySeries(entries, new Date("2026-08-01T00:00:00+08:00"));
const current = series.find((item) => item.current);

assert.equal(current?.key, "2026-08");
assert.equal(current?.total, 12000);
assert.equal(series.find((item) => item.key === "2026-07")?.current, false);

console.log("income monthly series tests passed");
