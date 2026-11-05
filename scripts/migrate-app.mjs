import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const schema = `
create table if not exists cv (
	id           integer primary key default 1 check (id = 1),
	filename     text not null,
	mime_type    text not null,
	byte_size    integer not null,
	data         bytea not null,
	updated_at   timestamptz not null default now()
);

create table if not exists message (
	id            bigserial primary key,
	user_id       text not null references "user"(id) on delete cascade,
	sender_name   text not null,
	sender_email  text not null,
	subject       text not null,
	body          text not null,
	created_at    timestamptz not null default now(),
	read_at       timestamptz
);

create index if not exists message_created_at_idx
	on message (created_at desc);

create index if not exists message_unread_idx
	on message (id) where read_at is null;
`;

try {
	await pool.query(schema);
	console.log("app tables ensured: cv, message");
} finally {
	await pool.end();
}
