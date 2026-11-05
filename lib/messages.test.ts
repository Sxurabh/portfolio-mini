import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { query } from "./db.ts";
import {
	countUnread,
	createMessage,
	listMessages,
	setMessageRead,
} from "./messages.ts";

const subject = `TDD message test ${Date.now()}`;
let userId = "";

before(async () => {
	const users = await query<{ id: string }>('select id from "user" limit 1');
	assert.ok(users[0], "the Better Auth migration should provide a test user");
	userId = users[0].id;
	await query("delete from message where subject = $1", [subject]);
});

after(async () => {
	await query("delete from message where subject = $1", [subject]);
});

test("message helpers list, count unread, mark read, and enforce rate limit", async () => {
	const unreadBefore = await countUnread();
	const message = await createMessage({
		userId,
		senderName: "TDD Sender",
		senderEmail: "tdd@example.com",
		subject,
		body: "A plain-text message body.",
	});

	assert.equal(message.subject, subject);
	assert.equal(message.body, "A plain-text message body.");
	assert.equal(message.userId, userId);
	assert.equal(message.readAt, null);
	assert.equal((await listMessages())[0].id, message.id);
	assert.equal(await countUnread(), unreadBefore + 1);

	await setMessageRead(message.id, true);
	assert.equal(await countUnread(), unreadBefore);

	await assert.rejects(
		createMessage({
			userId,
			senderName: "TDD Sender",
			senderEmail: "tdd@example.com",
			subject,
			body: "The second immediate message should be rate limited.",
		}),
		(error: { status?: number }) => error.status === 429,
	);
});
