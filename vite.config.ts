import tsdownConfig from "./tsdown.config.js"
import { defineConfig } from "vite-plus"

export default defineConfig({
	fmt: {
		semi: false,
		useTabs: true,
		printWidth: 4000,
	},
	pack: tsdownConfig,
	lint: {
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
})
