import { Pool } from "pg";

const globalForDb = globalThis as unknown as { dbPool?: Pool };

export const pool =
	globalForDb.dbPool ??
	new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
	globalForDb.dbPool = pool;
}

/**
 * Run a query and return typed rows. `pg` casts `bytea` to a Buffer.
 */
export async function query<T = unknown>(
	sql: string,
	params?: Array<unknown>,
): Promise<T[]> {
	const result = await pool.query(sql, params);
	return result.rows as T[];
}
