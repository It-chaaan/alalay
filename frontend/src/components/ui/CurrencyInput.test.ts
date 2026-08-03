import assert from "node:assert/strict";
import { formatCurrencyInputValue } from "./CurrencyInput";

assert.equal(formatCurrencyInputValue(20000), "20,000");
assert.equal(formatCurrencyInputValue("1039.04"), "1,039.04");
assert.equal(formatCurrencyInputValue(""), "");
assert.equal(formatCurrencyInputValue("20000.999"), "20,000.99");

console.log("currency input formatting tests passed");
