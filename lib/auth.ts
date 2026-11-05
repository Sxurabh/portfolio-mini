import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer, oauthPopup } from "better-auth/plugins";
import { pool } from "./db.ts";

/**
 * Comma-separated list of owner emails.
 * Sign-in is open to all supported OAuth accounts; this list only controls
 * owner-only features.
 */
export const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
	.split(",")
	.map((email) => email.trim().toLowerCase())
	.filter(Boolean);

export function isAllowedEmail(email?: string | null) {
	if (!email) return false;

	return allowedEmails.includes(email.trim().toLowerCase());
}

export const auth = betterAuth({
	database: pool,
	baseURL: process.env.BETTER_AUTH_URL,
	secret: process.env.BETTER_AUTH_SECRET,
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
		},
		github: {
			clientId: process.env.GITHUB_CLIENT_ID as string,
			clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
			// Better Auth requests these by default; kept explicit so the
			// primary email is available for the allowlist check.
			scope: ["read:user", "user:email"],
		},
	},
	session: {
		// Signed cookie cache so most getSession() calls skip the database.
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},
	account: {
		accountLinking: {
			enabled: true,
			// GitHub can report the owner's Gmail as unverified (its /user/emails
			// lookup needs the GitHub App's email permission), so treat both
			// providers as trusted. Emails must still match before linking.
			trustedProviders: ["google", "github"],
		},
	},
	onAPIError: {
		errorURL: "/auth/error",
	},
	plugins: [oauthPopup(), bearer(), nextCookies()],
});
