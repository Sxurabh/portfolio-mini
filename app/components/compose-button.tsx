"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	Button,
	Input,
	Label,
	Modal,
	Spinner,
	TextArea,
	useOverlayState,
} from "@heroui/react";
import { SendIcon } from "./icons";

const MAX_SUBJECT_LENGTH = 120;
const MAX_BODY_LENGTH = 2000;

async function readError(response: Response) {
	try {
		const payload = (await response.json()) as { error?: string };
		return payload.error ?? "Something went wrong.";
	} catch {
		return "Something went wrong.";
	}
}

export function ComposeButton() {
	const router = useRouter();
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSending, setIsSending] = useState(false);

	const reset = () => {
		setSubject("");
		setBody("");
		setError(null);
		setIsSending(false);
	};

	const state = useOverlayState({
		onOpenChange: (isOpen) => {
			if (!isOpen) reset();
		},
	});

	const handleOpenChange = (isOpen: boolean) => {
		state.setOpen(isOpen);
	};

	const sendMessage = async () => {
		const trimmedSubject = subject.trim();
		const trimmedBody = body.trim();

		if (!trimmedSubject) {
			setError("Please add a subject.");
			return;
		}

		if (trimmedSubject.length > MAX_SUBJECT_LENGTH) {
			setError("Subject must be 120 characters or fewer.");
			return;
		}

		if (!trimmedBody) {
			setError("Please write a message.");
			return;
		}

		if (trimmedBody.length > MAX_BODY_LENGTH) {
			setError("Message must be 2,000 characters or fewer.");
			return;
		}

		setIsSending(true);
		setError(null);

		try {
			const response = await fetch("/api/messages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ subject: trimmedSubject, body: trimmedBody }),
			});

			if (!response.ok) throw new Error(await readError(response));

			state.close();
			reset();
			router.refresh();
		} catch (sendError) {
			setError(sendError instanceof Error ? sendError.message : "Could not send message.");
			setIsSending(false);
		}
	};

	return (
		<Modal state={state}>
			<Button
				aria-label="Write a message"
				isIconOnly
				size="sm"
				variant="tertiary"
				onPress={state.open}
			>
				<SendIcon className="text-base" />
			</Button>
			<Modal.Backdrop>
				<Modal.Container size="md">
					<Modal.Dialog>
						<Modal.CloseTrigger className="right-5 top-5" />
						<Modal.Header>
							<Modal.Heading>Write a message</Modal.Heading>
							<p className="text-sm text-muted">
								This goes straight to Saurabh&apos;s inbox.
							</p>
						</Modal.Header>
						<Modal.Body className="flex flex-col gap-4">
							<div className="flex flex-col gap-1">
								<Label htmlFor="message-subject">Subject</Label>
								<Input
									autoComplete="off"
									fullWidth
									id="message-subject"
									disabled={isSending}
									maxLength={MAX_SUBJECT_LENGTH}
									placeholder="What is this about?"
									value={subject}
									onChange={(event) => setSubject(event.target.value)}
								/>
							</div>
							<div className="flex flex-col gap-1">
								<Label htmlFor="message-body">Message</Label>
								<TextArea
									fullWidth
									id="message-body"
									disabled={isSending}
									maxLength={MAX_BODY_LENGTH}
									placeholder="Write your message..."
									rows={5}
									value={body}
									onChange={(event) => setBody(event.target.value)}
								/>
								<span className="self-end text-xs text-muted">
									{body.length}/{MAX_BODY_LENGTH}
								</span>
							</div>
							{error && (
								<p className="text-sm text-danger" role="alert">
									{error}
								</p>
							)}
						</Modal.Body>
						<Modal.Footer className="flex-col sm:flex-row">
							<Button
								className="w-full sm:w-auto"
								isDisabled={isSending}
								variant="tertiary"
								onPress={() => handleOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								className="w-full sm:w-auto"
								isDisabled={isSending}
								onPress={sendMessage}
							>
								{isSending ? <Spinner aria-label="Sending message" /> : "Send message"}
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
