import Link from "next/link";

type Props = {
	searchParams: Promise<{ error?: string }>;
};

/**
 * Human-readable text for the codes Better Auth puts in `?error=`.
 * Unknown codes fall back to the raw value below.
 */
const errorMessages: Record<string, string> = {
	access_denied: "The authorization was cancelled on the provider.",
	account_not_linked:
		"This provider's email does not match the account already signed in.",
	email_does_not_match:
		"This provider's email does not match the account already signed in.",
	account_already_linked_to_different_user:
		"That provider account is already linked to a different user.",
	unable_to_link_account: "The existing account could not be linked.",
	email_not_found: "The provider did not return an email address.",
	email_not_verified: "The provider did not verify the email address.",
	POPUP_BLOCKED:
		"Your browser blocked the sign-in popup. Allow popups for this site and try again.",
	POPUP_TIMEOUT: "The sign-in popup timed out. Please try again.",
	POPUP_SIGN_IN_FAILED:
		"The sign-in popup could not complete. Please try again.",
};

export default async function AuthErrorPage({ searchParams }: Props) {
	const { error } = await searchParams;

	return (
		<section className="max-w-md">
			<h1 className="mb-4 text-2xl font-semibold tracking-tight">
				Sign-in failed
			</h1>
			<p className="mb-2 text-base text-muted">
				Sign in with Google or GitHub to send a message. Inbox access is
				reserved for the portfolio owner.
			</p>
			{error ? (
				<div className="mb-6 flex flex-col gap-1 text-sm text-muted">
					<p>{errorMessages[error] ?? "Sign-in could not be completed."}</p>
					<p className="text-xs opacity-70">Error: {error}</p>
				</div>
			) : (
				<div className="mb-6" />
			)}
			<Link className="button button--tertiary button--sm" href="/">
				Back home
			</Link>
		</section>
	);
}
