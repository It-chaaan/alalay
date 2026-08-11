import assert from "node:assert/strict";
import { getCategoryColor } from "./categoryColors";

assert.equal(getCategoryColor("Food"), "#e8775d");
assert.equal(getCategoryColor("Utilities"), "#d8a21b");
assert.equal(getCategoryColor("Subscriptions"), "#6fbf9a");
assert.equal(getCategoryColor("Uncategorized", 2), getCategoryColor("Uncategorized", 0));
assert.notEqual(getCategoryColor("Healthcare"), getCategoryColor("Food"));
assert.notEqual(getCategoryColor("Transportation"), getCategoryColor("Utilities"));
assert.equal(getCategoryColor("Transportation"), getCategoryColor("Transport"));

console.log("category color mapping tests passed");
