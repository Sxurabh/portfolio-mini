import { test } from "node:test";
import assert from "node:assert/strict";
import { query } from "./db.ts";

test("query returns a row", async () => {
	const rows = await query<{ ok: number }>("select 1 as ok");

	assert.equal(rows.length, 1);
	assert.equal(rows[0].ok, 1);
});

test("query with params returns bound values", async () => {
	const rows = await query<{ n: number }>("select $1::int as n", [42]);

	assert.equal(rows.length, 1);
	assert.equal(rows[0].n, 42);
});
