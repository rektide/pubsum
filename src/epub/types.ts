import type { EpubMetadata, EpubSpine, EpubProcessedChapter } from "@lingo-reader/epub-parser"

export type { EpubToc, EpubGuide, PageList } from "@lingo-reader/epub-parser"
export type { EpubMetadata, EpubSpine }

export interface EpubBook {
	metadata: EpubMetadata
	spine: EpubSpine
	toc: import("@lingo-reader/epub-parser").EpubToc
	guide: import("@lingo-reader/epub-parser").EpubGuide
	pageList: import("@lingo-reader/epub-parser").PageList
	loadChapter: (id: string) => Promise<EpubProcessedChapter | undefined>
	destroy: () => void
}
