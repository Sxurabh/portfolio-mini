import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { query } from "./db.ts";
import { getCvFile, getCvMeta, saveCv } from "./cv.ts";

const fixture = {
	filename: "probe-cv.pdf",
	mimeType: "application/pdf",
	byteSize: 9,
	data: Buffer.from("%PDF-probe"),
};

before(async () => {
	await query("delete from cv");
});

after(async () => {
	await query("delete from cv");
});

test("CV helpers read metadata and bytes after saving a CV", async () => {
	assert.equal(await getCvMeta(), null);

	await saveCv(fixture);

	const meta = await getCvMeta();
	assert.ok(meta);
	assert.deepEqual(meta, {
		id: 1,
		filename: fixture.filename,
		mimeType: fixture.mimeType,
		byteSize: fixture.byteSize,
		updatedAt: meta.updatedAt,
	});
	assert.ok(meta.updatedAt instanceof Date);

	const file = await getCvFile();
	assert.ok(file);
	assert.equal(file.filename, fixture.filename);
	assert.equal(file.mimeType, fixture.mimeType);
	assert.deepEqual(file.data, fixture.data);
});
