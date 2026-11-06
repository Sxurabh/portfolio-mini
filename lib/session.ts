import { headers } from "next/headers";
import { auth, isAllowedEmail } from "./auth";

export async function getSession() {
	return auth.api.getSession({ headers: await headers() });
}

export async function getCurrentUser() {
	const session = await getSession();

	return session?.user ?? null;
}

/**
 * Server-side owner guard. Use this at the top of every admin action
 * (CV upload/delete, etc.) — hiding UI is not protection.
 */
export async function isOwner() {
	const user = await getCurrentUser();

	return isAllowedEmail(user?.email);
}
