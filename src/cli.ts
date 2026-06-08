import { cli, define } from "gunshi"
import epubPlugin from "./plugin/epub.ts"
import modelPlugin, { formatProviders, formatModels } from "./plugin/model.ts"
import opencodePlugin from "./plugin/opencode.ts"
import { pluginId as opencodePluginId } from "./plugin/opencode.ts"
import { pluginId as modelPluginId } from "./plugin/model.ts"
import type { OpencodeExtension } from "./plugin/opencode.ts"
import type { EpubExtension } from "./plugin/epub.ts"
import type { ModelExtension } from "./plugin/model.ts"

type Extensions = {
	[opencodePluginId]: OpencodeExtension
	[modelPluginId]: ModelExtension
	epub: EpubExtension
}

const mainCommand = define<{
	extensions: Extensions
}>({
	name: "sum-pub",
	description: "Summarize epub chapters using opencode",
	toKebab: true,
	run: async ctx => {
		if (ctx.values.listProviders) {
			const client = ctx.extensions[modelPluginId].client
			const resp = await client.config.providers()
			const providers = resp.data?.providers
			if (providers?.length) {
				process.stdout.write(formatProviders(providers) + "\n")
			}
			return
		}

		if (ctx.values.listModels) {
			const client = ctx.extensions[modelPluginId].client
			const resp = await client.config.providers()
			const providers = resp.data?.providers
			if (providers?.length) {
				process.stdout.write(formatModels(providers) + "\n")
			}
			return
		}

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
