"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { authClient } from "../../lib/auth-client";
import { GitHubIcon, GoogleIcon, LogOutIcon } from "./icons";

function Spinner() {
	return (
		<svg
			aria-hidden="true"
			className="h-4 w-4 animate-spin"
			fill="none"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<circle
				cx="12"
				cy="12"
				r="9"
				stroke="currentColor"
				strokeOpacity="0.25"
				strokeWidth="3"
			/>
			<path
				d="M21 12a9 9 0 0 0-9-9"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth="3"
			/>
		</svg>
	);
}

export function AuthButtons({
	isOwner,
	inbox,
	compose,
}: {
	isOwner?: boolean;
	inbox?: ReactNode;
	compose?: ReactNode;
}) {
	isOwner ??= false;
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const [pendingProvider, setPendingProvider] = useState<
		"google" | "github" | null
	>(null);
	const [signingOut, setSigningOut] = useState(false);

	if (isPending) {
		return (
			<div className="flex shrink-0 items-center gap-2" aria-hidden="true">
				<div className="h-9 w-9 animate-pulse rounded-full bg-surface" />
				<div className="h-9 w-9 animate-pulse rounded-full bg-surface" />
			</div>
		);
	}

	if (session?.user) {
		return (
			<div className="flex shrink-0 items-center gap-2">
				{isOwner ? inbox : compose}
				{session.user.image ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						alt={session.user.name ?? "Profile"}
						className="h-9 w-9 rounded-full border border-border object-cover"
						referrerPolicy="no-referrer"
						src={session.user.image}
						title={session.user.name ?? "Signed in"}
					/>
				) : (
					<span
						className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-sm font-medium"
						title={session.user.name ?? "Signed in"}
					>
						{session.user.name?.trim().charAt(0).toUpperCase() || "U"}
					</span>
				)}
				<Button
					aria-label="Sign out"
					isDisabled={signingOut}
					isIconOnly
					size="sm"
					variant="tertiary"
					onPress={async () => {
						setSigningOut(true);

						try {
							await authClient.signOut();
							router.refresh();
						} finally {
							setSigningOut(false);
						}
					}}
				>
					{signingOut ? <Spinner /> : <LogOutIcon className="text-base" />}
				</Button>
			</div>
		);
	}

	const signIn = async (provider: "google" | "github") => {
		setPendingProvider(provider);

		const { error } = await authClient.signIn.popup({
			provider,
			callbackURL: "/",
		});

		setPendingProvider(null);

		// Closing the popup is a deliberate cancel, not a failure.
		if (!error || error.code === "POPUP_CLOSED") {
			router.refresh();
			return;
		}

		router.push(`/auth/error?error=${encodeURIComponent(error.code)}`);
	};

	return (
		<div className="flex shrink-0 items-center gap-2">
			<Button
				aria-label="Sign in with Google"
				isDisabled={pendingProvider !== null}
				isIconOnly
				size="sm"
				variant="tertiary"
				onPress={() => signIn("google")}
			>
				{pendingProvider === "google" ? (
					<Spinner />
				) : (
					<GoogleIcon className="text-base" />
				)}
			</Button>
			<Button
				aria-label="Sign in with GitHub"
				isDisabled={pendingProvider !== null}
				isIconOnly
				size="sm"
				variant="tertiary"
				onPress={() => signIn("github")}
			>
				{pendingProvider === "github" ? (
					<Spinner />
				) : (
					<GitHubIcon className="text-base" />
				)}
			</Button>
		</div>
	);
}
