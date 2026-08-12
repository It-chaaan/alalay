import assert from "node:assert/strict";
import { parseMobileReceipt } from "./ocr.service.js";

const result = parseMobileReceipt({
  text: "SM SUPERMARKET\nMILK 95.50\nBREAD 68.00\nSUBTOTAL 163.50\nTOTAL 163.50\nCASH 200.00\nCHANGE 36.50",
  lines: ["SM SUPERMARKET", "MILK 95.50", "BREAD 68.00", "SUBTOTAL 163.50", "TOTAL 163.50", "CASH 200.00", "CHANGE 36.50"],
});

assert.equal(result.merchant, "SM SUPERMARKET");
assert.equal(result.total, 163.5);
assert.deepEqual(result.items, [{ description: "MILK", amount: 95.5 }, { description: "BREAD", amount: 68 }]);
assert.equal(parseMobileReceipt({ text: "TOTAL 1,250.75", lines: ["TOTAL 1,250.75"] }).total, 1250.75);

console.log("Mobile receipt parser tests passed");
