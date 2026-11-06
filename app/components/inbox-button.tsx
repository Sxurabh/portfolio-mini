"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
	Button,
	Chip,
	EmptyState,
	Link,
	Modal,
	Spinner,
	useOverlayState,
} from "@heroui/react";
import { InboxIcon, TrashIcon } from "./icons";

type InboxMessage = {
	id: number;
	userId: string;
	senderName: string;
	senderEmail: string;
	subject: string;
	body: string;
	createdAt: string;
	readAt: string | null;
};

function relativeTime(value: string) {
	const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));

	if (seconds < 60) return "just now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

	return new Date(value).toLocaleDateString();
}

async function readError(response: Response) {
	try {
		const payload = (await response.json()) as { error?: string };
		return payload.error ?? "Something went wrong.";
	} catch {
		return "Something went wrong.";
	}
}

export function InboxButton({ unreadCount }: { unreadCount: number }) {
	const router = useRouter();
	const state = useOverlayState();
	const [messages, setMessages] = useState<InboxMessage[]>([]);
	const [expandedId, setExpandedId] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!state.isOpen) return;

		let cancelled = false;

		async function loadMessages() {
			setIsLoading(true);
			setError(null);

			try {
				const response = await fetch("/api/messages", { cache: "no-store" });

				if (!response.ok) throw new Error(await readError(response));

				const data = (await response.json()) as InboxMessage[];
				if (!cancelled) setMessages(data);
			} catch (loadError) {
				if (!cancelled) {
					setError(loadError instanceof Error ? loadError.message : "Could not load messages.");
				}
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}

		void loadMessages();

		return () => {
			cancelled = true;
		};
	}, [state.isOpen]);

	const toggleMessage = async (message: InboxMessage) => {
		setExpandedId((current) => (current === message.id ? null : message.id));

		if (message.readAt) return;

		const response = await fetch(`/api/messages/${message.id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ read: true }),
		});

		if (!response.ok) {
			setError(await readError(response));
			return;
		}

		setMessages((current) =>
			current.map((item) =>
				item.id === message.id ? { ...item, readAt: new Date().toISOString() } : item,
			),
		);
		router.refresh();
	};

	const removeMessage = async (id: number) => {
		setDeletingId(id);
		setError(null);

		try {
			const response = await fetch(`/api/messages/${id}`, { method: "DELETE" });

			if (!response.ok) throw new Error(await readError(response));

			setMessages((current) => current.filter((message) => message.id !== id));
			setExpandedId((current) => (current === id ? null : current));
			router.refresh();
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : "Could not delete message.");
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className="relative">
			<Modal state={state}>
				<Button
					aria-label={unreadCount > 0 ? `Inbox, ${unreadCount} unread` : "Inbox"}
					className="relative"
					isIconOnly
					size="sm"
					variant="tertiary"
					onPress={state.open}
				>
					<InboxIcon className="text-base" />
					{unreadCount > 0 && (
						<Chip
							aria-label={`${unreadCount} unread`}
							className="pointer-events-none absolute -right-1 -top-2 min-w-4 px-1 text-[10px]"
							color="danger"
							size="sm"
							variant="primary"
						>
							{unreadCount > 99 ? "99+" : unreadCount}
						</Chip>
					)}
				</Button>
				<Modal.Backdrop>
					<Modal.Container size="lg" scroll="inside">
						<Modal.Dialog>
							<Modal.CloseTrigger className="right-5 top-5" />
							<Modal.Header>
								<Modal.Heading>Inbox</Modal.Heading>
								<p className="text-sm text-muted">Messages from portfolio visitors.</p>
							</Modal.Header>
							<Modal.Body className="flex flex-col gap-3">
								{error && <p className="text-sm text-danger">{error}</p>}
								{isLoading ? (
									<div className="flex justify-center py-8" role="status">
										<Spinner aria-label="Loading messages" />
									</div>
								) : messages.length === 0 ? (
									<EmptyState>
										<p>No messages yet.</p>
									</EmptyState>
								) : (
									<div className="flex flex-col gap-2">
										{messages.map((message) => (
											<div className="flex items-start gap-2" key={message.id}>
												<Button
													className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left"
													fullWidth
													variant="tertiary"
													onPress={() => toggleMessage(message)}
												>
													<span className="flex w-full flex-col gap-1">
														<span className="flex items-center gap-2 text-sm">
															{!message.readAt && (
																<span
																	aria-label="Unread"
																	className="h-2 w-2 shrink-0 rounded-full bg-accent"
																/>
															)}
															<strong className="truncate">{message.subject}</strong>
															<span className="ml-auto shrink-0 text-xs text-muted">
																{relativeTime(message.createdAt)}
															</span>
														</span>
														<span className="truncate text-xs text-muted">
															{message.senderName} · {message.senderEmail}
														</span>
														{expandedId === message.id && (
															<span className="mt-2 whitespace-pre-wrap text-sm font-normal text-foreground">
																{message.body}
															</span>
														)}
													</span>
												</Button>
												<Button
													aria-label={`Delete message: ${message.subject}`}
													className={
														expandedId === message.id
															? "mt-1 shrink-0"
															: "shrink-0 self-center"
													}
													isDisabled={deletingId === message.id}
													isIconOnly
													size="sm"
													variant="ghost"
													onPress={() => removeMessage(message.id)}
												>
													{deletingId === message.id ? (
														<Spinner aria-label="Deleting message" />
													) : (
														<TrashIcon className="text-base" />
													)}
												</Button>
											</div>
										))}
									</div>
								)}
							</Modal.Body>
							{expandedId !== null && messages.length > 0 && (
								<Modal.Footer>
									<Link
										href={`mailto:${messages.find((message) => message.id === expandedId)?.senderEmail ?? ""}`}
									>
										Reply by email
									</Link>
								</Modal.Footer>
							)}
						</Modal.Dialog>
					</Modal.Container>
				</Modal.Backdrop>
			</Modal>
		</div>
	);
}
