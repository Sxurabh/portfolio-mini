#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SUBJECT_PREFIX="messages-probe-$(date +%s)-$$"
STATE_FILE="$(mktemp -t portfolio-messages-probe-state.XXXXXX)"
RESPONSE_FILE="$(mktemp -t portfolio-messages-probe-response.XXXXXX)"

cleanup() {
	if [[ -f "$STATE_FILE" ]]; then
		# shellcheck disable=SC1090
		source "$STATE_FILE"
		PROBE_MEMBER_ID="${PROBE_MEMBER_ID:-}" \
		PROBE_OWNER_SESSION_ID="${PROBE_OWNER_SESSION_ID:-}" \
		PROBE_MEMBER_SESSION_ID="${PROBE_MEMBER_SESSION_ID:-}" \
		PROBE_SUBJECT_PREFIX="${PROBE_SUBJECT_PREFIX:-}" \
		node --env-file="$ROOT_DIR/.env.local" - <<'NODE' >/dev/null 2>&1 || true
const { Pool } = await import("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query('delete from message where subject like $1', [`${process.env.PROBE_SUBJECT_PREFIX}%`]);
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

PROBE_SUBJECT_PREFIX="$SUBJECT_PREFIX" node --env-file="$ROOT_DIR/.env.local" - "$STATE_FILE" <<'NODE'
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
	[memberId, "Messages Probe Member", `${memberId}@example.com`, now],
);
await pool.query(
	`insert into session ("id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
	 values ($1, $2, $3, $4, $4, null, 'messages-probe', $5), ($6, $2, $7, $4, $4, null, 'messages-probe', $8)`,
	[ownerSessionId, expires, ownerToken, now, owner.rows[0].id, memberSessionId, memberToken, memberId],
);

const ownerCookie = await signCookieValue(ownerToken, process.env.BETTER_AUTH_SECRET);
const memberCookie = await signCookieValue(memberToken, process.env.BETTER_AUTH_SECRET);
await fs.writeFile(
	stateFile,
	[
		`OWNER_COOKIE='better-auth.session_token=${ownerCookie}'`,
		`MEMBER_COOKIE='better-auth.session_token=${memberCookie}'`,
		`PROBE_MEMBER_ID='${memberId}'`,
		`PROBE_OWNER_SESSION_ID='${ownerSessionId}'`,
		`PROBE_MEMBER_SESSION_ID='${memberSessionId}'`,
		`PROBE_SUBJECT_PREFIX='${process.env.PROBE_SUBJECT_PREFIX}'`,
	].join("\n") + "\n",
);
await pool.end();
NODE

# shellcheck disable=SC1090
source "$STATE_FILE"

status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/messages")"
[[ "$status" == "401" ]] || { echo "expected signed-out GET 401, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $MEMBER_COOKIE" "$BASE_URL/api/messages")"
[[ "$status" == "403" ]] || { echo "expected member GET 403, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"subject":"signed out","body":"no"}' "$BASE_URL/api/messages")"
[[ "$status" == "401" ]] || { echo "expected signed-out POST 401, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $MEMBER_COOKIE" -H 'Content-Type: application/json' -d '{"subject":"","body":"invalid"}' "$BASE_URL/api/messages")"
[[ "$status" == "400" ]] || { echo "expected empty subject 400, got $status" >&2; exit 1; }

first_subject="$SUBJECT_PREFIX first"
status="$(curl -sS -o "$RESPONSE_FILE" -w '%{http_code}' -H "Cookie: $MEMBER_COOKIE" -H 'Content-Type: application/json' -d "{\"subject\":\"$first_subject\",\"body\":\"First probe message\"}" "$BASE_URL/api/messages")"
[[ "$status" == "201" ]] || { echo "expected member POST 201, got $status" >&2; cat "$RESPONSE_FILE" >&2; exit 1; }

second_subject="$SUBJECT_PREFIX second"
status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $MEMBER_COOKIE" -H 'Content-Type: application/json' -d "{\"subject\":\"$second_subject\",\"body\":\"Second probe message\"}" "$BASE_URL/api/messages")"
[[ "$status" == "429" ]] || { echo "expected immediate second POST 429, got $status" >&2; exit 1; }

curl -sS -o "$RESPONSE_FILE" -H "Cookie: $OWNER_COOKIE" "$BASE_URL/api/messages"
PROBE_SUBJECT_PREFIX="$SUBJECT_PREFIX" python3 - "$RESPONSE_FILE" <<'PY'
import json
import os
import sys

messages = json.load(open(sys.argv[1]))
assert isinstance(messages, list)
assert messages
assert messages[0]["subject"] == os.environ["PROBE_SUBJECT_PREFIX"] + " first"
assert messages[0]["body"] == "First probe message"
PY

echo "Messages route probe passed"
