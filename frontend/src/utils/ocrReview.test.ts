import assert from "node:assert/strict";
import { isLowConfidenceOcr, shouldBlockOcrLogging } from "./ocrReview";

assert.equal(isLowConfidenceOcr(59), true);
assert.equal(isLowConfidenceOcr(60), false);
assert.equal(shouldBlockOcrLogging(34, 0), true);
assert.equal(shouldBlockOcrLogging(34, 125), false);
assert.equal(shouldBlockOcrLogging(90, 0), false);

console.log("OCR review safety tests passed");
