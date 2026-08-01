import assert from "node:assert/strict";
import { getCategoryColor } from "./categoryColors";

assert.equal(getCategoryColor("Food"), "#e8775d");
assert.equal(getCategoryColor("Utilities"), "#7db59c");
assert.equal(getCategoryColor("Subscriptions"), "#9d90ac");
assert.equal(getCategoryColor("Uncategorized", 2), "#7db59c");

console.log("category color mapping tests passed");
