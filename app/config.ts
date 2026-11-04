export const siteConfig = {
	url: "https://jrgarciadev.com",
	author: {
		name: "Saurabh Kirve",
		role: "Analyst at Straive",
		description:
			"Data Analyst at Straive, building design-driven UI tools for web and mobile apps.",
		email: "saurabhkirve@gmail.com",
	},
	social: {
		twitter: {
			handle: "@sxurxbh",
			url: "https://twitter.com/sxurxbh",
		},
		github: {
			handle: "Sxurabh",
			url: "https://github.com/Sxurabh",
		},
		email: "saurabhkirve@gmail.com",
	},
	metadata: {
		title: {
			default: "Saurabh Kirve",
			template: "%s | Saurabh Kirve",
		},
		description:
			"Saurabh Kirve: Data Analyst at Straive",
		siteName: "Saurabh Kirve",
		locale: "en_US",
	},
	rss: {
		title: "Saurabh Kirve",
		description: "Saurabh Kirve's blog RSS feed",
	},
} as const;

export const baseUrl = siteConfig.url;
export const author = siteConfig.author;
export const social = siteConfig.social;
export const metadata = siteConfig.metadata;
