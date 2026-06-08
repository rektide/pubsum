import { initEpubFile } from "@lingo-reader/epub-parser"
import type { EpubMetadata, EpubSpine, EpubToc, EpubGuide, PageList, EpubProcessedChapter } from "@lingo-reader/epub-parser"

export interface EpubBook {
	metadata: EpubMetadata
	spine: EpubSpine
	toc: EpubToc
	guide: EpubGuide
	pageList: PageList
	loadChapter: (id: string) => Promise<EpubProcessedChapter | undefined>
	destroy: () => void
}

export async function openEpub(filePath: string): Promise<EpubBook> {
	const epub = await initEpubFile(filePath)
	return {
		metadata: epub.getMetadata(),
		spine: epub.getSpine(),
		toc: epub.getToc(),
		guide: epub.getGuide(),
		pageList: epub.getPageList(),
		loadChapter: (id: string) => epub.loadChapter(id),
		destroy: () => epub.destroy(),
	}
}
