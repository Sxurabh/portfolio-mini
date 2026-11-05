import { getCvFile, saveCv } from "../../../lib/cv";
import { getCurrentUser, isOwner } from "../../../lib/session";

const MAX_CV_BYTES = 4 * 1024 * 1024;

function jsonError(message: string, status: number, headers?: HeadersInit) {
	return Response.json({ error: message }, { status, headers });
}

function safeFilename(filename: string) {
	const cleaned = filename
		.replace(/[\\/\r\n"\0]/g, "_")
		.replace(/[^a-zA-Z0-9._ -]/g, "_")
		.trim()
		.slice(0, 120);

	return cleaned || "cv.pdf";
}

export async function GET(request: Request) {
	const cv = await getCvFile();

	if (!cv) {
		return jsonError("No CV is available.", 404);
	}

	const filename = safeFilename(cv.filename);
	const disposition = new URL(request.url).searchParams.has("download")
		? "attachment"
		: "inline";

	return new Response(new Uint8Array(cv.data), {
		status: 200,
		headers: {
			"Content-Type": cv.mimeType,
			"Content-Length": String(cv.data.byteLength),
			"Content-Disposition": `${disposition}; filename="${filename}"`,
			"Cache-Control": "private, no-store",
		},
	});
}

export async function POST(request: Request) {
	const user = await getCurrentUser();

	if (!user) {
		return jsonError("You must be signed in.", 401);
	}

	if (!(await isOwner())) {
		return jsonError("Only the owner can replace the CV.", 403);
	}

	let formData: FormData;

	try {
		formData = await request.formData();
	} catch {
		return jsonError("Expected a multipart file upload.", 400);
	}

	const file = formData.get("file");

	if (!(file instanceof File)) {
		return jsonError("A PDF file is required.", 400);
	}

	if (file.size > MAX_CV_BYTES) {
		return jsonError("The CV must be 4 MB or smaller.", 413);
	}

	if (file.type !== "application/pdf") {
		return jsonError("The CV must be a PDF.", 400);
	}

	const data = Buffer.from(await file.arrayBuffer());

	if (data.subarray(0, 5).toString("ascii") !== "%PDF-") {
		return jsonError("The uploaded file is not a valid PDF.", 400);
	}

	await saveCv({
		filename: safeFilename(file.name),
		mimeType: "application/pdf",
		byteSize: data.byteLength,
		data,
	});

	return Response.json({ ok: true }, { status: 200 });
}
