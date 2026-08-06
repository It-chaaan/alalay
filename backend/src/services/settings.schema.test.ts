import assert from "node:assert/strict";
import test from "node:test";
import { updateProfileSchema } from "../schemas/settings.schema.js";

test("profile updates reject client-controlled plan changes", () => {
  const result = updateProfileSchema.safeParse({ name: "Ada", plan: "family" });
  assert.equal(result.success, false);
});
