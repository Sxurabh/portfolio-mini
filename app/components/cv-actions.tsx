"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Spinner, useOverlayState } from "@heroui/react";
import { UploadIcon } from "./icons";

const MAX_CV_BYTES = 4 * 1024 * 1024;

async function readError(response: Response) {
	try {
		const payload = (await response.json()) as { error?: string };
		return payload.error ?? "Something went wrong.";
	} catch {
		return "Something went wrong.";
	}
}

export function CvActions({
	hasCv,
	isOwner,
}: {
	hasCv: boolean;
	isOwner: boolean;
}) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);

	const reset = () => {
		setFileName(null);
		setError(null);
		setIsUploading(false);

		if (inputRef.current) inputRef.current.value = "";
	};

	const state = useOverlayState({
		onOpenChange: (isOpen) => {
			if (!isOpen) reset();
		},
	});

	if (!isOwner) return null;

	const handleOpenChange = (isOpen: boolean) => {
		state.setOpen(isOpen);
	};

	const upload = async () => {
		const file = inputRef.current?.files?.[0];

		if (!file) {
			setError("Choose a PDF file first.");
			return;
		}

		if (file.type !== "application/pdf") {
			setError("The CV must be a PDF.");
			return;
		}

		if (file.size > MAX_CV_BYTES) {
			setError("The CV must be 4 MB or smaller.");
			return;
		}

		setIsUploading(true);
		setError(null);

		try {
			const formData = new FormData();
			formData.append("file", file);

			const response = await fetch("/api/cv", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) throw new Error(await readError(response));

			state.close();
			reset();
			router.refresh();
		} catch (uploadError) {
			setError(uploadError instanceof Error ? uploadError.message : "Could not upload CV.");
			setIsUploading(false);
		}
	};

	return (
		<Modal state={state}>
			<Button
				size="sm"
				variant="tertiary"
				onPress={state.open}
			>
				<UploadIcon className="text-base" />
				{hasCv ? "Replace CV" : "Upload CV"}
			</Button>
			<Modal.Backdrop>
				<Modal.Container size="md">
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>{hasCv ? "Replace CV" : "Upload CV"}</Modal.Heading>
							<p className="text-sm text-muted">
								PDF only, up to 4 MB. Uploading replaces the current CV immediately.
							</p>
						</Modal.Header>
						<Modal.Body className="gap-4">
							<input
								accept="application/pdf"
								aria-label="CV file"
								className="block w-full cursor-pointer rounded-xl border border-border bg-surface p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
								disabled={isUploading}
								ref={inputRef}
								type="file"
								onChange={(event) => {
									setFileName(event.target.files?.[0]?.name ?? null);
									setError(null);
								}}
							/>
							{fileName && <p className="text-xs text-muted">Selected: {fileName}</p>}
							{error && (
								<p className="text-sm text-danger" role="alert">
									{error}
								</p>
							)}
						</Modal.Body>
						<Modal.Footer>
							<Button
								isDisabled={isUploading}
								variant="tertiary"
								onPress={() => handleOpenChange(false)}
							>
								Cancel
							</Button>
							<Button isDisabled={isUploading} onPress={upload}>
								{isUploading ? <Spinner aria-label="Uploading CV" /> : "Upload"}
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
