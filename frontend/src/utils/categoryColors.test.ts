import assert from "node:assert/strict";
import { getCategoryColor } from "./categoryColors";

assert.equal(getCategoryColor("Food"), "#e8775d");
assert.equal(getCategoryColor("Utilities"), "#7db59c");
assert.equal(getCategoryColor("Subscriptions"), "#9d90ac");
assert.equal(getCategoryColor("Uncategorized", 2), "#7db59c");
assert.notEqual(getCategoryColor("Repair"), getCategoryColor("Food"));
assert.notEqual(getCategoryColor("Transportation"), getCategoryColor("Utilities"));
assert.equal(getCategoryColor("Transportation"), getCategoryColor("Transport"));

console.log("category color mapping tests passed");
