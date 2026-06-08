import { plugin } from "gunshi/plugin"
import { openEpub } from "../epub/reader.ts"
import type { EpubBook } from "../epub/reader.ts"

export const pluginId = "epub" as const

export interface EpubExtension {
	book: EpubBook | null
	html: string
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
		},
		extension: async ctx => {
			const file = ctx.values.file as string | undefined
			const chapter = ctx.values.chapter as number | undefined
			if (!file || chapter == null) {
				return { book: null, html: "", destroy: () => {} }
			}
			const book = await openEpub(file)
			if (isNaN(chapter) || chapter < 1 || chapter > book.spine.length) {
				throw new Error(`Invalid chapter ordinal: ${chapter}. Must be 1-${book.spine.length}`)
			}
			const loaded = await book.loadChapter(book.spine[chapter - 1].id)
			if (!loaded) {
				throw new Error("Failed to load chapter content")
			}
			return {
				book,
				html: loaded.html,
				destroy: () => book.destroy(),
			}
		},
	})
}
