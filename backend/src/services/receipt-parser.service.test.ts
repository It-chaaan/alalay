import assert from "node:assert/strict";
import { parseReceiptText } from "./receipt-parser.service.js";

const parsed = parseReceiptText("SM SUPERMARKET\n2026-08-14\nMILK 95.50\nBREAD 68.00\nSUBTOTAL 163.50\nTOTAL ₱163.50\nCASH 200.00");
assert.equal(parsed.merchant, "SM SUPERMARKET");
assert.equal(parsed.total, 163.5);
assert.equal(parsed.currency, "PHP");
assert.equal(parsed.date, "2026-08-14");
assert.equal(parsed.suggestedCategory, "Groceries");
assert.deepEqual(parsed.lineItems, [{ description: "MILK", amount: 95.5 }, { description: "BREAD", amount: 68 }]);
assert.equal(parseReceiptText("AMOUNT DUE 1,250.75").total, 1250.75);
assert.equal(parseReceiptText("receipt copy\n08/12/2026").date, null);
assert.equal(parseReceiptText("no useful data").total, null);
console.log("Receipt parser tests passed");
