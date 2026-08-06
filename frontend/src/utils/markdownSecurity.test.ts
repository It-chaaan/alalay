import assert from "node:assert/strict";
import test from "node:test";
import { isSafeMarkdownUrl } from "./markdownSecurity";

test("markdown only permits http and https links", () => {
  assert.equal(isSafeMarkdownUrl("https://example.com"), true);
  assert.equal(isSafeMarkdownUrl("javascript:alert(1)"), false);
  assert.equal(isSafeMarkdownUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeMarkdownUrl("http://example.com/%22%20onerror=alert(1)"), true);
});
