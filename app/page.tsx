import Image from "next/image";
import {
	DownloadIcon,
	EnvelopeIcon,
	GitHubIcon,
	InstagramIcon,
	LinkedInIcon,
	LinkIcon,
	TwitterIcon,
} from "./components/icons";
import { social } from "./config";

export default function Page() {
	return (
		<section className="w-full">
			<header className="mb-6 flex flex-row items-center gap-4">
				<div className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
					<Image
						className="h-full w-full object-cover"
						width={100}
						height={100}
						src="/avatar.png"
						alt="Junior Garcia"
					/>
				</div>
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
						href="https://eclerx.com/"
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
					className="button button--tertiary button--sm"
					href={`mailto:${social.email}`}
				>
					<EnvelopeIcon />
					Email
				</a>
				<a
					className="button button--tertiary button--sm"
					href="/saurabh-kirve-cv.pdf"
					download
				>
					<DownloadIcon />
					Download CV
				</a>
				{social.linkedin.url && (
					<a
						className="button button--tertiary button--sm"
						href={social.linkedin.url}
						target="_blank"
						rel="noopener noreferrer"
					>
						<LinkedInIcon />
						LinkedIn
					</a>
				)}
				{social.instagram.url && (
					<a
						className="button button--tertiary button--sm"
						href={social.instagram.url}
						target="_blank"
						rel="noopener noreferrer"
					>
						<InstagramIcon />
						Instagram
					</a>
				)}
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
			<hr className="my-6 border-border" />
			<div className="mb-12 space-y-4">
				<h2 className="text-sm font-semibold">Projects</h2>
				<div className="grid gap-4 -mx-2">
					<a
						className="bg-surface shadow-surface dark:bg-surface-secondary p-4 rounded-2xl gap-1"
						href="https://github.com/Sxurabh/JobPortalScraper"
						target="_blank"
						rel="noopener noreferrer"
					>
						<span className="flex items-center gap-1">
							Job Portal Scraper
							<LinkIcon className="text-sm text-muted/60" />
						</span>
						<p className="text-sm text-muted">
							A personal job discovery dashboard that watches career portals, keeps your job history organized, and sends matching roles to Telegram.
						</p>
					</a>
				</div>
			</div>
			
		</section>
	);
}
