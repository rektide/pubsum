import { cli, define } from "gunshi"
import epubPlugin from "./plugin/epub.ts"
import opencodePlugin from "./plugin/opencode.ts"
import { pluginId } from "./plugin/opencode.ts"
import type { OpencodeExtension } from "./plugin/opencode.ts"
import type { EpubExtension } from "./plugin/epub.ts"

type Extensions = {
	[pluginId]: OpencodeExtension
	epub: EpubExtension
}

const mainCommand = define<{
	extensions: Extensions
}>({
	name: "sum-pub",
	description: "Summarize epub chapters using opencode",
	run: ctx => {
		const response = ctx.extensions[pluginId].response
		process.stdout.write(response)
	},
})

export default async function main() {
	await cli(process.argv.slice(2), mainCommand, {
		name: "sum-pub",
		version: "0.1.0",
		plugins: [epubPlugin(), opencodePlugin()],
	})
}
