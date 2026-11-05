#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_FILE="$(mktemp -t portfolio-message-id-probe-state.XXXXXX)"
RESPONSE_FILE="$(mktemp -t portfolio-message-id-probe-response.XXXXXX)"

cleanup() {
	if [[ -f "$STATE_FILE" ]]; then
		# shellcheck disable=SC1090
		source "$STATE_FILE"
		PROBE_MESSAGE_ID="${PROBE_MESSAGE_ID:-}" \
		PROBE_MEMBER_ID="${PROBE_MEMBER_ID:-}" \
		PROBE_OWNER_SESSION_ID="${PROBE_OWNER_SESSION_ID:-}" \
		PROBE_MEMBER_SESSION_ID="${PROBE_MEMBER_SESSION_ID:-}" \
		node --env-file="$ROOT_DIR/.env.local" - <<'NODE' >/dev/null 2>&1 || true
const { Pool } = await import("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.PROBE_MESSAGE_ID) {
	await pool.query("delete from message where id = $1", [process.env.PROBE_MESSAGE_ID]);
}
await pool.query('delete from session where id in ($1, $2)', [
	process.env.PROBE_OWNER_SESSION_ID,
	process.env.PROBE_MEMBER_SESSION_ID,
]);
if (process.env.PROBE_MEMBER_ID) {
	await pool.query('delete from "user" where id = $1', [process.env.PROBE_MEMBER_ID]);
}
await pool.end();
NODE
	fi
	rm -f "$STATE_FILE" "$RESPONSE_FILE"
}
trap cleanup EXIT

node --env-file="$ROOT_DIR/.env.local" - "$STATE_FILE" <<'NODE'
const fs = await import("node:fs/promises");
const crypto = await import("node:crypto");
const { Pool } = await import("pg");
const { signCookieValue } = await import("./node_modules/better-call/dist/crypto.mjs");

const stateFile = process.argv[2];
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const owner = await pool.query('select id from "user" where lower(email) = lower($1) limit 1', [
	process.env.ALLOWED_EMAILS.split(",")[0].trim(),
]);
if (!owner.rows[0]) throw new Error("owner account not found");

const memberId = crypto.randomBytes(18).toString("base64url");
const ownerSessionId = crypto.randomBytes(18).toString("base64url");
const memberSessionId = crypto.randomBytes(18).toString("base64url");
const ownerToken = crypto.randomBytes(24).toString("base64url");
const memberToken = crypto.randomBytes(24).toString("base64url");
const now = new Date();
const expires = new Date(Date.now() + 60 * 60 * 1000);

await pool.query(
	`insert into "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt")
	 values ($1, $2, $3, false, null, $4, $4)`,
	[memberId, "Message ID Probe Member", `${memberId}@example.com`, now],
);
await pool.query(
	`insert into session ("id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
	 values ($1, $2, $3, $4, $4, null, 'message-id-probe', $5), ($6, $2, $7, $4, $4, null, 'message-id-probe', $8)`,
	[ownerSessionId, expires, ownerToken, now, owner.rows[0].id, memberSessionId, memberToken, memberId],
);
const inserted = await pool.query(
	`insert into message (user_id, sender_name, sender_email, subject, body)
	 values ($1, $2, $3, $4, $5) returning id`,
	[memberId, "Message ID Probe Member", `${memberId}@example.com`, "message-id-probe", "Probe body"],
);

const ownerCookie = await signCookieValue(ownerToken, process.env.BETTER_AUTH_SECRET);
const memberCookie = await signCookieValue(memberToken, process.env.BETTER_AUTH_SECRET);
await fs.writeFile(
	stateFile,
	[
		`OWNER_COOKIE='better-auth.session_token=${ownerCookie}'`,
		`MEMBER_COOKIE='better-auth.session_token=${memberCookie}'`,
		`PROBE_MESSAGE_ID='${inserted.rows[0].id}'`,
		`PROBE_MEMBER_ID='${memberId}'`,
		`PROBE_OWNER_SESSION_ID='${ownerSessionId}'`,
		`PROBE_MEMBER_SESSION_ID='${memberSessionId}'`,
	].join("\n") + "\n",
);
await pool.end();
NODE

# shellcheck disable=SC1090
source "$STATE_FILE"
message_url="$BASE_URL/api/messages/$PROBE_MESSAGE_ID"

status="$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH -H 'Content-Type: application/json' -d '{"read":true}' "$message_url")"
[[ "$status" == "401" ]] || { echo "expected signed-out PATCH 401, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE -H "Cookie: $MEMBER_COOKIE" "$message_url")"
[[ "$status" == "403" ]] || { echo "expected member DELETE 403, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH -H "Cookie: $OWNER_COOKIE" -H 'Content-Type: application/json' -d '{"read":true}' "$BASE_URL/api/messages/999999999")"
[[ "$status" == "404" ]] || { echo "expected missing PATCH 404, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH -H "Cookie: $MEMBER_COOKIE" -H 'Content-Type: application/json' -d '{"read":true}' "$message_url")"
[[ "$status" == "403" ]] || { echo "expected member PATCH 403, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH -H "Cookie: $OWNER_COOKIE" -H 'Content-Type: application/json' -d '{"read":true}' "$message_url")"
[[ "$status" == "200" ]] || { echo "expected owner PATCH 200, got $status" >&2; exit 1; }

curl -sS -o "$RESPONSE_FILE" -H "Cookie: $OWNER_COOKIE" "$BASE_URL/api/messages"
PROBE_MESSAGE_ID="$PROBE_MESSAGE_ID" python3 - "$RESPONSE_FILE" <<'PY'
import json
import os
import sys

messages = json.load(open(sys.argv[1]))
message = next(item for item in messages if str(item["id"]) == os.environ["PROBE_MESSAGE_ID"])
assert message["readAt"] is not None
PY

status="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE -H "Cookie: $OWNER_COOKIE" "$message_url")"
[[ "$status" == "200" ]] || { echo "expected owner DELETE 200, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE -H "Cookie: $OWNER_COOKIE" "$message_url")"
[[ "$status" == "404" ]] || { echo "expected repeated DELETE 404, got $status" >&2; exit 1; }

echo "Message ID route probe passed"
