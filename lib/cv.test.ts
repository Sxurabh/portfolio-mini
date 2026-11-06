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

type CvBackup = {
	filename: string;
	mime_type: string;
	byte_size: number;
	data: string;
	updated_at: Date;
};

// Never destroy a real uploaded CV when the suite runs against the shared DB.
let backup: CvBackup | null = null;

before(async () => {
	const rows = await query<CvBackup>(`
		select filename, mime_type, byte_size, encode(data, 'base64') as data, updated_at
		from cv
		where id = 1
		limit 1
	`);
	backup = rows[0] ?? null;
	await query("delete from cv");
});

after(async () => {
	await query("delete from cv");

	if (backup) {
		await query(
			`insert into cv (id, filename, mime_type, byte_size, data, updated_at)
			 values (1, $1, $2, $3, $4, $5)`,
			[
				backup.filename,
				backup.mime_type,
				backup.byte_size,
				Buffer.from(backup.data, "base64"),
				backup.updated_at,
			],
		);
	}
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
