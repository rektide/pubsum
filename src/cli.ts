import { cli, define } from "gunshi"
import epubPlugin from "./plugin/epub.ts"
import modelPlugin from "./plugin/model.ts"
import opencodePlugin from "./plugin/opencode.ts"
import { pluginId as opencodePluginId } from "./plugin/opencode.ts"
import type { OpencodeExtension } from "./plugin/opencode.ts"
import type { EpubExtension } from "./plugin/epub.ts"
import type { ModelExtension } from "./plugin/model.ts"

type Extensions = {
	[opencodePluginId]: OpencodeExtension
	epub: EpubExtension
	model: ModelExtension
}

const mainCommand = define<{
	extensions: Extensions
}>({
	name: "sum-pub",
	description: "Summarize epub chapters using opencode",
	run: ctx => {
		const response = ctx.extensions[opencodePluginId].response
		process.stdout.write(response)
	},
})

export default async function main() {
	await cli(process.argv.slice(2), mainCommand, {
		name: "sum-pub",
		version: "0.1.0",
		plugins: [epubPlugin(), modelPlugin(), opencodePlugin()],
	})
}
