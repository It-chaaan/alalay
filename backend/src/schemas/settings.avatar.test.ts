import assert from "node:assert/strict";
import test from "node:test";
import { updateAvatarSchema, updateProfileSchema } from "./settings.schema.js";

test("profile editing cannot write raw avatar URLs or image data", () => {
  assert.equal(updateProfileSchema.safeParse({ avatar_url: "https://example.com/avatar.png" }).success, false);
  assert.equal(updateAvatarSchema.safeParse({ avatar_path: "user/avatar/version.jpg" }).success, true);
  assert.equal(updateAvatarSchema.safeParse({ avatar_path: null }).success, true);
});
