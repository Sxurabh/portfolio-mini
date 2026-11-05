import {
	deleteMessage,
	setMessageRead,
} from "../../../../lib/messages";
import { getCurrentUser, isOwner } from "../../../../lib/session";

type RouteContext = {
	params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
	return Response.json({ error: message }, { status });
}

async function getOwnerMessageId(context: RouteContext) {
	const user = await getCurrentUser();

	if (!user) {
		return { response: jsonError("You must be signed in.", 401), id: null };
	}

	if (!(await isOwner())) {
		return {
			response: jsonError("Only the owner can manage messages.", 403),
			id: null,
		};
	}

	const { id: rawId } = await context.params;

	if (!/^\d+$/.test(rawId)) {
		return { response: jsonError("Message ID is invalid.", 400), id: null };
	}

	const id = Number(rawId);

	if (!Number.isSafeInteger(id) || id < 1) {
		return { response: jsonError("Message ID is invalid.", 400), id: null };
	}

	return { response: null, id };
}

export async function PATCH(request: Request, context: RouteContext) {
	const { response, id } = await getOwnerMessageId(context);

	if (response) return response;
	if (id === null) return jsonError("Message ID is invalid.", 400);

	let payload: { read?: unknown };

	try {
		payload = await request.json();
	} catch {
		return jsonError("Expected a JSON update.", 400);
	}

	if (typeof payload.read !== "boolean") {
		return jsonError("The read value must be boolean.", 400);
	}

	if (!(await setMessageRead(id, payload.read))) {
		return jsonError("Message not found.", 404);
	}

	return Response.json({ ok: true });
}

export async function DELETE(request: Request, context: RouteContext) {
	void request;
	const { response, id } = await getOwnerMessageId(context);

	if (response) return response;
	if (id === null) return jsonError("Message ID is invalid.", 400);

	if (!(await deleteMessage(id))) {
		return jsonError("Message not found.", 404);
	}

	return Response.json({ ok: true });
}
