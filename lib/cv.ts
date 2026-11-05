import { query } from "./db.ts";

export type CvMeta = {
	id: number;
	filename: string;
	mimeType: string;
	byteSize: number;
	updatedAt: Date;
};

export type CvFile = {
	data: Buffer;
	mimeType: string;
	filename: string;
};

type CvMetaRow = {
	id: number;
	filename: string;
	mime_type: string;
	byte_size: number;
	updated_at: Date;
};

type CvFileRow = {
	data: Buffer;
	mime_type: string;
	filename: string;
};

export async function getCvMeta(): Promise<CvMeta | null> {
	const rows = await query<CvMetaRow>(`
		select id, filename, mime_type, byte_size, updated_at
		from cv
		where id = 1
		limit 1
	`);
	const row = rows[0];

	if (!row) return null;

	return {
		id: row.id,
		filename: row.filename,
		mimeType: row.mime_type,
		byteSize: row.byte_size,
		updatedAt: row.updated_at,
	};
}

export async function getCvFile(): Promise<CvFile | null> {
	const rows = await query<CvFileRow>(`
		select data, mime_type, filename
		from cv
		where id = 1
		limit 1
	`);
	const row = rows[0];

	if (!row) return null;

	return {
		data: row.data,
		mimeType: row.mime_type,
		filename: row.filename,
	};
}

export async function saveCv(input: {
	filename: string;
	mimeType: string;
	byteSize: number;
	data: Buffer;
}): Promise<void> {
	await query(
		`
		insert into cv (id, filename, mime_type, byte_size, data, updated_at)
		values (1, $1, $2, $3, $4, now())
		on conflict (id) do update set
			filename = excluded.filename,
			mime_type = excluded.mime_type,
			byte_size = excluded.byte_size,
			data = excluded.data,
			updated_at = now()
		`,
		[input.filename, input.mimeType, input.byteSize, input.data],
	);
}
