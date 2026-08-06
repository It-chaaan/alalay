import assert from "node:assert/strict";
import test from "node:test";
import { updateProfileSchema } from "./settings.schema.js";

test("profile avatar_url accepts short URLs and rejects data URLs", () => {
  assert.equal(updateProfileSchema.safeParse({ avatar_url: "https://example.com/avatar.png" }).success, true);
  assert.equal(updateProfileSchema.safeParse({ avatar_url: `https://example.com/${"a".repeat(600)}` }).success, false);
  assert.equal(updateProfileSchema.safeParse({ avatar_url: `data:image/png;base64,${"a".repeat(1000)}` }).success, false);
});
