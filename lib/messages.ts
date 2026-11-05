import { query } from "./db.ts";

const MESSAGE_RATE_LIMIT_MS = 60_000;
const lastMessageAt = new Map<string, number>();

export type Message = {
	id: number;
	userId: string;
	senderName: string;
	senderEmail: string;
	subject: string;
	body: string;
	createdAt: Date;
	readAt: Date | null;
};

type MessageRow = {
	id: string | number;
	user_id: string;
	sender_name: string;
	sender_email: string;
	subject: string;
	body: string;
	created_at: Date;
	read_at: Date | null;
};

export class MessageRateLimitError extends Error {
	readonly status = 429;
	readonly retryAfter: number;

	constructor(retryAfter: number) {
		super("Please wait before sending another message.");
		this.name = "MessageRateLimitError";
		this.retryAfter = retryAfter;
	}
}

function toMessage(row: MessageRow): Message {
	return {
		id: Number(row.id),
		userId: row.user_id,
		senderName: row.sender_name,
		senderEmail: row.sender_email,
		subject: row.subject,
		body: row.body,
		createdAt: row.created_at,
		readAt: row.read_at,
	};
}

export async function listMessages(): Promise<Message[]> {
	const rows = await query<MessageRow>(`
		select id, user_id, sender_name, sender_email, subject, body,
			created_at, read_at
		from message
		order by created_at desc, id desc
		limit 50
	`);

	return rows.map(toMessage);
}

export async function createMessage(input: {
	userId: string;
	senderName: string;
	senderEmail: string;
	subject: string;
	body: string;
}): Promise<Message> {
	const now = Date.now();
	const previous = lastMessageAt.get(input.userId);

	if (previous !== undefined) {
		const elapsed = now - previous;

		if (elapsed < MESSAGE_RATE_LIMIT_MS) {
			throw new MessageRateLimitError(
				Math.max(1, Math.ceil((MESSAGE_RATE_LIMIT_MS - elapsed) / 1000)),
			);
		}
	}

	const rows = await query<MessageRow>(
		`
		insert into message (
			user_id, sender_name, sender_email, subject, body
		)
		values ($1, $2, $3, $4, $5)
		returning id, user_id, sender_name, sender_email, subject, body,
			created_at, read_at
		`,
		[
			input.userId,
			input.senderName,
			input.senderEmail,
			input.subject,
			input.body,
		],
	);

	lastMessageAt.set(input.userId, now);
	return toMessage(rows[0]);
}

export async function setMessageRead(
	id: number,
	read: boolean,
): Promise<boolean> {
	const rows = await query<{ id: string | number }>(
		`
		update message
		set read_at = case when $2 then now() else null end
		where id = $1
		returning id
		`,
		[id, read],
	);

	return rows.length > 0;
}

export async function deleteMessage(id: number): Promise<boolean> {
	const rows = await query<{ id: string | number }>(
		"delete from message where id = $1 returning id",
		[id],
	);

	return rows.length > 0;
}

export async function countUnread(): Promise<number> {
	const rows = await query<{ count: string }>(
		"select count(*)::text as count from message where read_at is null",
	);

	return Number(rows[0]?.count ?? 0);
}
