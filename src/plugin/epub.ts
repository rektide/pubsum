import { plugin } from "gunshi/plugin"
import { readFile } from "node:fs/promises"
import { openEpub } from "../epub/reader.ts"
import type { EpubBook } from "../epub/reader.ts"

export const pluginId = "epub" as const

export interface ChapterContent {
	html: string
	title: string
}

export interface EpubExtension {
	book: EpubBook | null
	bookTitle: string
	existingSummary: string
	spineLength: number
	loadChapter: (ordinal: number) => Promise<ChapterContent>
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
			ctx.addGlobalOption("chapters", {
				type: "string",
				short: "c",
				description: "Chapter(s): single (5), range (5-8), or list (5,6,7)",
			})
			ctx.addGlobalOption("output", {
				type: "string",
				short: "o",
				description: "Append summaries to markdown file",
			})
		},
		extension: async ctx => {
			const file = ctx.values.file as string | undefined
			const outputPath = ctx.values.output as string | undefined

			let existingSummary = ""
			if (outputPath) {
				try {
					existingSummary = await readFile(outputPath, "utf-8")
				} catch {
					existingSummary = ""
				}
			}

			if (!file) {
				return {
					book: null,
					bookTitle: "",
					existingSummary,
					spineLength: 0,
					loadChapter: async () => ({ html: "", title: "" }),
					destroy: () => {},
				}
			}

			const book = await openEpub(file)

			const loadChapter = async (ordinal: number): Promise<ChapterContent> => {
				if (ordinal < 1 || ordinal > book.spine.length) {
					throw new Error(`Invalid chapter ordinal: ${ordinal}. Must be 1-${book.spine.length}`)
				}
				const spineItem = book.spine[ordinal - 1]
				const loaded = await book.loadChapter(spineItem.id)
				if (!loaded) {
					throw new Error(`Failed to load chapter ${ordinal}`)
				}
				return {
					html: loaded.html,
					title: spineItem.href?.split("/").pop()?.replace(/\.[^.]+$/, "") ?? `Chapter ${ordinal}`,
				}
			}

			return {
				book,
				bookTitle: book.metadata.title ?? "",
				existingSummary,
				spineLength: book.spine.length,
				loadChapter,
				destroy: () => book.destroy(),
			}
		},
	})
}
