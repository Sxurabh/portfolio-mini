#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_FILE="$(mktemp -t portfolio-cv-probe-state.XXXXXX)"
PDF_FILE="$(mktemp -t portfolio-cv-probe.XXXXXX.pdf)"
INVALID_FILE="$(mktemp -t portfolio-cv-invalid.XXXXXX.txt)"
LARGE_FILE="$(mktemp -t portfolio-cv-large.XXXXXX.pdf)"
HEADERS_FILE="$(mktemp -t portfolio-cv-headers.XXXXXX)"
BODY_FILE="$(mktemp -t portfolio-cv-body.XXXXXX)"

cleanup() {
	if [[ -f "$STATE_FILE" ]]; then
		# shellcheck disable=SC1090
		source "$STATE_FILE"
		PROBE_MEMBER_ID="${PROBE_MEMBER_ID:-}" \
		PROBE_OWNER_SESSION_ID="${PROBE_OWNER_SESSION_ID:-}" \
		PROBE_MEMBER_SESSION_ID="${PROBE_MEMBER_SESSION_ID:-}" \
		node --env-file="$ROOT_DIR/.env.local" - <<'NODE' >/dev/null 2>&1 || true
const { Pool } = await import("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await pool.query('delete from session where id in ($1, $2)', [
	process.env.PROBE_OWNER_SESSION_ID,
	process.env.PROBE_MEMBER_SESSION_ID,
]);
if (process.env.PROBE_MEMBER_ID) {
	await pool.query('delete from "user" where id = $1', [process.env.PROBE_MEMBER_ID]);
}
await pool.query("delete from cv");
await pool.end();
NODE
	fi
	rm -f "$STATE_FILE" "$PDF_FILE" "$INVALID_FILE" "$LARGE_FILE" "$HEADERS_FILE" "$BODY_FILE"
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
	[memberId, "CV Probe Member", `${memberId}@example.com`, now],
);
await pool.query(
	`insert into session ("id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
	 values ($1, $2, $3, $4, $4, null, 'cv-probe', $5), ($6, $2, $7, $4, $4, null, 'cv-probe', $8)`,
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
	].join("\n") + "\n",
);
await pool.end();
NODE

python3 - "$PDF_FILE" "$INVALID_FILE" "$LARGE_FILE" <<'PY'
from pathlib import Path
import sys
Path(sys.argv[1]).write_bytes(b"%PDF-1.4\\n% CV probe\\n")
Path(sys.argv[2]).write_bytes(b"not a pdf")
Path(sys.argv[3]).write_bytes(b"%PDF-" + b"x" * (4 * 1024 * 1024))
PY

status="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/cv")"
[[ "$status" == "404" ]] || { echo "expected empty GET 404, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -F "file=@$PDF_FILE;type=application/pdf" "$BASE_URL/api/cv")"
[[ "$status" == "401" ]] || { echo "expected signed-out POST 401, got $status" >&2; exit 1; }

# shellcheck disable=SC1090
source "$STATE_FILE"
status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $MEMBER_COOKIE" -F "file=@$PDF_FILE;type=application/pdf" "$BASE_URL/api/cv")"
[[ "$status" == "403" ]] || { echo "expected member POST 403, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $OWNER_COOKIE" -F "file=@$PDF_FILE;type=application/pdf" "$BASE_URL/api/cv")"
[[ "$status" == "200" ]] || { echo "expected owner POST 200, got $status" >&2; exit 1; }

curl -sS -D "$HEADERS_FILE" -o "$BODY_FILE" "$BASE_URL/api/cv"
grep -qi '^content-type: application/pdf' "$HEADERS_FILE"
grep -qi '^content-disposition: inline;' "$HEADERS_FILE"
grep -q '%PDF-' "$BODY_FILE"

curl -sS -D "$HEADERS_FILE" -o /dev/null "$BASE_URL/api/cv?download=1"
grep -qi '^content-disposition: attachment;' "$HEADERS_FILE"

status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $OWNER_COOKIE" -F "file=@$INVALID_FILE;type=application/pdf" "$BASE_URL/api/cv")"
[[ "$status" == "400" ]] || { echo "expected invalid PDF 400, got $status" >&2; exit 1; }

status="$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $OWNER_COOKIE" -F "file=@$LARGE_FILE;type=application/pdf" "$BASE_URL/api/cv")"
[[ "$status" == "413" ]] || { echo "expected large PDF 413, got $status" >&2; exit 1; }

echo "CV route probe passed"
