export interface ChapterContent {
	html: string
	title: string
}

export interface TokenUsage {
	input: number
	output: number
	reasoning: number
	cacheRead: number
	cacheWrite: number
}

export interface SummarizeResult {
	response: string
	usage: TokenUsage
}

export interface EpubExtension {
	book: import("../epub/types.ts").EpubBook | null
	bookTitle: string
	existingSummary: string
	spineLength: number
	toc: import("../epub/types.ts").EpubToc
	guide: import("../epub/types.ts").EpubGuide
	pageList: import("../epub/types.ts").PageList
	loadChapter: (ordinal: number) => Promise<ChapterContent>
	destroy: () => void
}

export interface ModelExtension {
	client: import("@opencode-ai/sdk").OpencodeClient
	providerID: string
	modelID: string
	contextLimit: number
}

export interface OpencodeExtension {
	contextLimit: number
	sessionId: string | null
	summarize: (html: string, chapterTitle: string, chapterOrdinal: number, existingSummary: string) => Promise<SummarizeResult>
	getSessionUsage: () => Promise<TokenUsage>
	resetSession: () => void
}
