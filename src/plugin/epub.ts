import { plugin } from "gunshi/plugin"
import { readFile } from "node:fs/promises"
import { openEpub } from "../epub/reader.ts"
import type { EpubBook } from "../epub/reader.ts"

export const pluginId = "epub" as const

export interface EpubExtension {
	book: EpubBook | null
	html: string
	chapterTitle: string
	bookTitle: string
	existingSummary: string
	destroy: () => void
}

export default function epubPlugin() {
	return plugin<{}, typeof pluginId, [], EpubExtension>({
		id: pluginId,
		setup: ctx => {
			ctx.addGlobalOption("file", {
				type: "string",
				short: "f",
				description: "epub file path",
			})
			ctx.addGlobalOption("chapter", {
				type: "number",
				short: "c",
				description: "chapter ordinal (1-based)",
			})
			ctx.addGlobalOption("output", {
				type: "string",
				short: "o",
				description: "Append summary to markdown file",
			})
		},
		extension: async ctx => {
			const file = ctx.values.file as string | undefined
			const chapter = ctx.values.chapter as number | undefined
			const outputPath = ctx.values.output as string | undefined

			let existingSummary = ""
			if (outputPath) {
				try {
					existingSummary = await readFile(outputPath, "utf-8")
				} catch {
					existingSummary = ""
				}
			}

			if (!file || chapter == null) {
				return { book: null, html: "", chapterTitle: "", bookTitle: "", existingSummary, destroy: () => {} }
			}
			const book = await openEpub(file)
			if (isNaN(chapter) || chapter < 1 || chapter > book.spine.length) {
				throw new Error(`Invalid chapter ordinal: ${chapter}. Must be 1-${book.spine.length}`)
			}
			const spineItem = book.spine[chapter - 1]
			const loaded = await book.loadChapter(spineItem.id)
			if (!loaded) {
				throw new Error("Failed to load chapter content")
			}
			return {
				book,
				html: loaded.html,
				chapterTitle: spineItem.href?.split("/").pop()?.replace(/\.[^.]+$/, "") ?? `Chapter ${chapter}`,
				bookTitle: book.metadata.title ?? "",
				existingSummary,
				destroy: () => book.destroy(),
			}
		},
	})
}
