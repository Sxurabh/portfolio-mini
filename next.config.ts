import type { NextConfig } from "next";

const config: NextConfig = {
	reactCompiler: true,
	serverExternalPackages: ["pg"],
};

export default config;
