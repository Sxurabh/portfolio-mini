import {
	createMessage,
	listMessages,
	MessageRateLimitError,
} from "../../../lib/messages";
import { getCurrentUser, isOwner } from "../../../lib/session";

const MAX_SUBJECT_LENGTH = 120;
const MAX_BODY_LENGTH = 2000;

function jsonError(message: string, status: number, headers?: HeadersInit) {
	return Response.json({ error: message }, { status, headers });
}

async function requireUser() {
	const user = await getCurrentUser();

	if (!user) {
		return {
			response: jsonError("You must be signed in.", 401),
			user: null,
		};
	}

	return { response: null, user };
}

export async function GET() {
	const { response, user } = await requireUser();

	if (response) return response;
	if (!user || !(await isOwner())) {
		return jsonError("Only the owner can read messages.", 403);
	}

	return Response.json(await listMessages());
}

export async function POST(request: Request) {
	const { response, user } = await requireUser();

	if (response) return response;
	if (!user) return jsonError("You must be signed in.", 401);

	let payload: { subject?: unknown; body?: unknown };

	try {
		payload = await request.json();
	} catch {
		return jsonError("Expected a JSON message.", 400);
	}

	if (typeof payload.subject !== "string" || typeof payload.body !== "string") {
		return jsonError("Subject and message are required.", 400);
	}

	const subject = payload.subject.trim();
	const body = payload.body.trim();

	if (!subject || !body) {
		return jsonError("Subject and message are required.", 400);
	}

	if (subject.length > MAX_SUBJECT_LENGTH) {
		return jsonError("Subject must be 120 characters or fewer.", 400);
	}

	if (body.length > MAX_BODY_LENGTH) {
		return jsonError("Message must be 2,000 characters or fewer.", 400);
	}

	try {
		const message = await createMessage({
			userId: user.id,
			senderName: user.name,
			senderEmail: user.email,
			subject,
			body,
		});

		return Response.json(message, { status: 201 });
	} catch (error) {
		if (error instanceof MessageRateLimitError) {
			return jsonError(
				error.message,
				429,
				{ "Retry-After": String(error.retryAfter) },
			);
		}

		throw error;
	}
}
