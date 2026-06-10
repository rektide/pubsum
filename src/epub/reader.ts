import { initEpubFile } from "@lingo-reader/epub-parser"
import type { EpubBook } from "./types.ts"

export type { EpubBook } from "./types.ts"
export type { EpubToc, EpubGuide, PageList } from "@lingo-reader/epub-parser"

export async function openEpub(filePath: string): Promise<EpubBook> {
	const epub = await initEpubFile(filePath)
	return {
		metadata: epub.getMetadata(),
		spine: epub.getSpine(),
		toc: epub.getToc(),
		guide: epub.getGuide(),
		pageList: epub.getPageList() ?? { label: "", pageTargets: [] },
		loadChapter: (id: string) => epub.loadChapter(id),
		destroy: () => epub.destroy(),
	}
}
