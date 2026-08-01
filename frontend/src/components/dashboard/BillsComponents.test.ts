import assert from "node:assert/strict";
import type { Bill } from "../../hooks/types";
import { getBillDisplayStatus, isOverdueBill, isUpcomingBill } from "./BillsComponents";

const today = "2026-08-01";
const bill = (id: string, due_date: string, status: Bill["status"]): Bill => ({
  id,
  title: id,
  amount: 100,
  category: "Utilities",
  due_date,
  frequency: null,
  recurring: false,
  status,
  paid_at: null,
  attachment_url: null,
  notes: null,
  created_at: today,
});

const dueToday = bill("today", today, "unpaid");
const future = bill("future", "2026-08-10", "unpaid");
const overdue = bill("overdue", "2026-07-31", "unpaid");
const paidPast = bill("paid", "2026-07-01", "paid");

assert.equal(isUpcomingBill(dueToday, today), true);
assert.equal(getBillDisplayStatus(dueToday, today), "due_today");
assert.equal(isUpcomingBill(future, today), true);
assert.equal(isOverdueBill(overdue, today), true);
assert.equal(isOverdueBill(paidPast, today), false);

const fixtures = [dueToday, future, overdue, paidPast];
assert.equal(fixtures.filter((item) => isUpcomingBill(item, today)).length, 2);
assert.equal(fixtures.filter((item) => isOverdueBill(item, today)).length, 1);
assert.equal(fixtures.filter((item) => item.status === "paid").length, 1);

console.log("bill tab categorization tests passed");
