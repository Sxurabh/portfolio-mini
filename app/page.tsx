import { Avatar, Separator } from "@heroui/react";
import Image from "next/image";
import {
	EnvelopeIcon,
	GitHubIcon,
	LinkIcon,
	TwitterIcon,
} from "./components/icons";
import { social } from "./config";

export default function Page() {
	return (
		<section className="w-full">
			<header className="mb-6 flex flex-row items-center gap-4">
				<Avatar className="h-12 w-12" size="lg">
					<Image
						className="avatar__image"
						width={100}
						height={100}
						src="/avatar.png"
						alt="Junior Garcia"
					/>
				</Avatar>
				<div className="flex flex-col">
					<h1 className="text-lg font-medium tracking-tight">Saurabh Kirve</h1>
					<p className="text-sm font-medium text-muted">
						Analyst at{" "}
						<a
							className="link text-inherit"
							href="https://www.straive.com/"
							target="_blank"
							rel="noopener noreferrer"
						>
							Straive
						</a>{" "}

						- Alternative Investment Operations × Data × Technology
						
					</p>
				</div>
			</header>
			<div className="mb-6 space-y-4">
				<p className="text-base text-wrap">
					
					I work at the intersection of{" "}
					<em className="font-medium">alternative investment operations</em>,{" "}
					<em className="font-medium">data management</em> and{" "}
					<em className="font-medium">technology</em>, transforming complex financial information into structured, reliable, and actionable insights. My focus is on simplifying investor onboarding, streamlining document workflows, improving data accuracy, and building smarter processes through automation and technology—so teams can spend less time managing operational complexity and more time focusing on what matters most:<em className="font-medium">delivering value and making better decisions</em>.
				</p>
				<p>
					Previously I worked at{" "}
					<a
						href="https://deel.com"
						target="_blank"
						className="link text-inherit text-base"
						rel="noopener noreferrer"
					>
						eClerx
					</a>{" "}
					as a Analyst
				</p>
			</div>
			<div className="-ml-1 flex gap-3 flex-wrap">
				<a
					className="button button--tertiary button--sm"ƒƒ
					href={`mailto:${social.email}`}
				>
					<EnvelopeIcon />
					Email
				</a>
				<a
					className="button button--tertiary button--sm"
					href={social.twitter.url}
					target="_blank"
				>
					<TwitterIcon />
					Twitter
				</a>
				<a
					className="button button--tertiary button--sm"
					href={social.github.url}
					target="_blank"
				>
					<GitHubIcon />
					GitHub
				</a>
			</div>
			<Separator className="my-6" />
			<div className="mb-12 space-y-4">
				<h2 className="text-sm font-semibold">Projects</h2>
				<div className="grid gap-4 -mx-2">
					<a
						className="bg-surface shadow-surface dark:bg-surface-secondary p-4 rounded-2xl gap-1"
						href="https://v3.heroui.com"
						target="_blank"
						rel="noopener noreferrer"
					>
						<span className="flex items-center gap-1">
							HeroUI
							<LinkIcon className="text-sm text-muted/60" />
						</span>
						<p className="text-sm text-muted">
							modern UI library for web and mobile, built to help you move fast,
							stay consistent, and deliver delightful user experiences.
						</p>
					</a>
					<a
						className="bg-surface-secondary dark:bg-surface p-4 rounded-2xl gap-1"
						href="https://tailwind-variants.org"
						target="_blank"
						rel="noopener noreferrer"
					>
						<span className="flex items-center gap-1">
							Tailwind Variants
							<LinkIcon className="text-sm text-muted/60" />
						</span>
						<p className="text-sm text-muted">
							A powerful variant API for Tailwind CSS, bringing a structured
							approach to design systems and UI components.
						</p>
					</a>
				</div>
			</div>
			{/* Coming soon */}
			{/* <div className="space-y-8">
				<h2 className="text-sm font-semibold">Writing</h2>
				<BlogPosts />
			</div> */}
		</section>
	);
}
