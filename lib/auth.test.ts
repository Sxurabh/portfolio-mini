import { test } from "node:test";
import assert from "node:assert/strict";
import { auth } from "./auth.ts";

test("auth client is initialized", () => {
	assert.ok(auth);
});
