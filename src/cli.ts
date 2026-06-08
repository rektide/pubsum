import { cli, define } from "gunshi"
import epubPlugin from "./plugin/epub.ts"
import modelPlugin, { formatProviders, formatModels } from "./plugin/model.ts"
import opencodePlugin from "./plugin/opencode.ts"
import { pluginId as opencodePluginId } from "./plugin/opencode.ts"
import { pluginId as modelPluginId } from "./plugin/model.ts"
import { pluginId as epubPluginId } from "./plugin/epub.ts"
import { SumPubState } from "./sum-pub/state.ts"
import type { OpencodeExtension } from "./plugin/opencode.ts"
import type { EpubExtension } from "./plugin/epub.ts"
import type { ModelExtension } from "./plugin/model.ts"

type Extensions = {
	[opencodePluginId]: OpencodeExtension
	[modelPluginId]: ModelExtension
	[epubPluginId]: EpubExtension
}

function parseOrdinals(input: string): number[] {
	const parts = input.split(",")
	const result: number[] = []
	for (const part of parts) {
		const trimmed = part.trim()
		if (trimmed.includes("-")) {
			const [startStr, endStr] = trimmed.split("-", 2)
			const start = Number(startStr)
			const end = Number(endStr)
			if (isNaN(start) || isNaN(end)) {
				throw new Error(`Invalid chapter range: ${trimmed}`)
			}
			for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
				result.push(i)
			}
		} else {
			const n = Number(trimmed)
			if (isNaN(n)) {
				throw new Error(`Invalid chapter ordinal: ${trimmed}`)
			}
			result.push(n)
		}
	}
	return [...new Set(result)].sort((a, b) => a - b)
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
			const resp = await client.provider.list()
			const connected = resp.data?.connected ?? []
			const defaults = resp.data?.default ?? {}
			const providers = (resp.data?.all ?? []).filter(p => connected.includes(p.id))
			const activeIdx = ctx.values.provider
				? providers.findIndex(p => p.id === ctx.values.provider)
				: 0
			if (providers.length) {
				process.stdout.write(formatProviders(providers, defaults, activeIdx) + "\n")
			}
			return
		}

		if (ctx.values.listModels) {
			const client = ctx.extensions[modelPluginId].client
			const resp = await client.provider.list()
			const connected = resp.data?.connected ?? []
			const defaults = resp.data?.default ?? {}
			const providers = (resp.data?.all ?? []).filter(p => connected.includes(p.id))
			if (providers.length) {
				process.stdout.write(formatModels(providers, defaults) + "\n")
			}
			return
		}

		if (ctx.values.listChapters) {
			const epub = ctx.extensions[epubPluginId]
			if (!epub.book) {
				process.stderr.write("Error: --list-chapters requires -f <epub>\n")
				process.exit(1)
			}
			for (let i = 0; i < epub.spineLength; i++) {
				const spineItem = epub.book!.spine[i]
				const title = spineItem.href?.split("/").pop()?.replace(/\.[^.]+$/, "") ?? `Chapter ${i + 1}`
				process.stdout.write(`  ${i + 1}. ${title}\n`)
			}
			return
		}

		const epub = ctx.extensions[epubPluginId]
		const oc = ctx.extensions[opencodePluginId]
		const chaptersArg = ctx.values.chapters as string | undefined
		const outputPath = ctx.values.output as string | undefined

		if (!chaptersArg || !epub.book) {
			process.stderr.write("Usage: sum-pub -f <epub> -c <chapters> [-o <output.md>]\n")
			process.exit(1)
		}

		const ordinals = parseOrdinals(chaptersArg)
		const userLimit = ctx.values.contextLimit as number | undefined
		const contextLimit = userLimit == null || userLimit === 0 ? Infinity : userLimit
		const noLimit = contextLimit === Infinity

		const state = new SumPubState(
			epub.bookTitle,
			epub.existingSummary,
			oc.sessionId,
			{ outputPath, contextLimit, modelContextLimit: oc.contextLimit },
			{
				loadChapter: epub.loadChapter,
				destroyBook: epub.destroy,
				summarize: oc.summarize,
				getSessionUsage: oc.getSessionUsage,
				resetSession: oc.resetSession,
			},
		)

		process.stderr.write(`${state.bookTitle} — ${ordinals.length} chapter(s): ${ordinals.join(", ")} | limit: ${noLimit ? "none (reactive only)" : contextLimit.toLocaleString() + " tokens"}\n`)

		try {
			for (const ordinal of ordinals) {
				await state.processChapter(ordinal)
			}
		} finally {
			state.destroy()
		}
	},
})

export default async function main() {
	await cli(process.argv.slice(2), mainCommand, {
		name: "sum-pub",
		version: "0.1.0",
		plugins: [epubPlugin(), modelPlugin(), opencodePlugin()],
	})
}
