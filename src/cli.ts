import { cli, define } from "gunshi"
import { appendFile } from "node:fs/promises"
import epubPlugin from "./plugin/epub.ts"
import modelPlugin, { formatProviders, formatModels } from "./plugin/model.ts"
import opencodePlugin from "./plugin/opencode.ts"
import { pluginId as opencodePluginId } from "./plugin/opencode.ts"
import { pluginId as modelPluginId } from "./plugin/model.ts"
import { pluginId as epubPluginId } from "./plugin/epub.ts"
import type { OpencodeExtension } from "./plugin/opencode.ts"
import type { EpubExtension } from "./plugin/epub.ts"
import type { ModelExtension } from "./plugin/model.ts"

type Extensions = {
	[opencodePluginId]: OpencodeExtension
	[modelPluginId]: ModelExtension
	[epubPluginId]: EpubExtension
}

function formatNumber(n: number): string {
	return n.toLocaleString()
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

		const epub = ctx.extensions[epubPluginId]
		const oc = ctx.extensions[opencodePluginId]
		const chaptersArg = ctx.values.chapters as string | undefined
		const outputPath = ctx.values.output as string | undefined

		if (!chaptersArg || !epub.book) {
			process.stderr.write("Usage: sum-pub -f <epub> -c <chapters> [-o <output.md>]\n")
			process.exit(1)
		}

		const ordinals = parseOrdinals(chaptersArg)
		let inMemorySummary = epub.existingSummary
		const userLimit = ctx.values.contextLimit as number | undefined
		const noProactiveLimit = userLimit == null || userLimit === 0
		const contextLimit = noProactiveLimit ? Infinity : userLimit

		process.stderr.write(`${epub.bookTitle} — ${ordinals.length} chapter(s): ${ordinals.join(", ")} | limit: ${noProactiveLimit ? "none (reactive only)" : formatNumber(contextLimit) + " tokens"}\n`)

		try {
			for (const ordinal of ordinals) {
				if (!noProactiveLimit) {
					const usageBefore = await oc.getSessionUsage()
					const totalBefore = usageBefore.input + usageBefore.cacheRead
					if (totalBefore >= contextLimit) {
						process.stderr.write(`\n  Context limit reached (${formatNumber(totalBefore)} / ${formatNumber(contextLimit)}), rotating session\n`)
						oc.resetSession()
					}
				}

				process.stderr.write(`\nChapter ${ordinal}... `)

				const chapter = await epub.loadChapter(ordinal)

				let result
				try {
					result = await oc.summarize(chapter.html, chapter.title, ordinal, inMemorySummary)
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					const stack = err instanceof Error ? err.stack : ""
					process.stderr.write(`\n  ERROR: ${msg}\n  ${stack}\n`)
					oc.resetSession()
					process.stderr.write(`  Retrying in new session...\n`)
					result = await oc.summarize(chapter.html, chapter.title, ordinal, inMemorySummary)
				}

				const entry = result.response + "\n\n"
				inMemorySummary += entry

				if (outputPath) {
					await appendFile(outputPath, entry)
					process.stderr.write(`appended to ${outputPath}`)
				} else {
					process.stdout.write(result.response + "\n")
				}

				if (result.usage) {
					const total = result.usage.input + result.usage.cacheRead
					const limitDisplay = noProactiveLimit ? oc.contextLimit : contextLimit
					const pct = limitDisplay > 0 && limitDisplay !== Infinity ? ((total / limitDisplay) * 100).toFixed(1) : "?"
					process.stderr.write(
						` | Tokens: ${formatNumber(result.usage.input)} in / ${formatNumber(result.usage.output)} out / ${formatNumber(result.usage.cacheRead)} cache | Context: ${formatNumber(total)} / ${formatNumber(limitDisplay)} (${pct}%)`
					)
				}
				process.stderr.write("\n")
			}
		} finally {
			epub.destroy()
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
