import { appendFile } from "node:fs/promises"
import type { ChapterContent } from "./plugin/types.ts"
import type { OpencodeExtension, TokenUsage } from "./plugin/types.ts"

export interface PubSumConfig {
	outputPath: string | undefined
	contextLimit: number
	modelContextLimit: number
}

export interface PubSumDeps {
	loadChapter: (ordinal: number) => Promise<ChapterContent>
	destroyBook: () => void
	summarize: OpencodeExtension["summarize"]
	getSessionUsage: () => Promise<TokenUsage>
	resetSession: () => void
}

export class PubSumState {
	summary: string
	prevTokenTotal: number
	completedOrdinals: number[]
	sessionId: string | null
	readonly config: PubSumConfig
	readonly deps: PubSumDeps
	readonly bookTitle: string

	constructor(
		bookTitle: string,
		existingSummary: string,
		sessionId: string | null,
		config: PubSumConfig,
		deps: PubSumDeps,
	) {
		this.bookTitle = bookTitle
		this.summary = existingSummary
		this.prevTokenTotal = 0
		this.completedOrdinals = []
		this.sessionId = sessionId
		this.config = config
		this.deps = deps
	}

	async processChapter(ordinal: number): Promise<void> {
		this.checkProactiveLimit()

		process.stderr.write(`\nChapter ${ordinal}... `)

		const chapter = await this.deps.loadChapter(ordinal)

		let result
		try {
			result = await this.deps.summarize(chapter.html, chapter.title, ordinal, this.summary)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			const stack = err instanceof Error ? err.stack : ""
			process.stderr.write(`\n  ERROR: ${msg}\n  ${stack}\n`)
			this.rotateSession()
			process.stderr.write(`  Retrying in new session...\n`)
			result = await this.deps.summarize(chapter.html, chapter.title, ordinal, this.summary)
		}

		const total = result.usage.input + result.usage.cacheRead
		if (this.detectCompaction(total)) {
			process.stderr.write(`\n  COMPACTION DETECTED: ${this.prevTokenTotal.toLocaleString()} → ${total.toLocaleString()} tokens. Redoing chapter in fresh session.\n`)
			this.rotateSession()
			result = await this.deps.summarize(chapter.html, chapter.title, ordinal, this.summary)
		}
		this.prevTokenTotal = result.usage.input + result.usage.cacheRead

		await this.appendResult(result.response, ordinal)
		this.logUsage(result.usage)
	}

	private checkProactiveLimit(): void {
		if (this.config.contextLimit === Infinity) return
		if (this.prevTokenTotal >= this.config.contextLimit) {
			process.stderr.write(`\n  Context limit reached (${this.prevTokenTotal.toLocaleString()} / ${this.config.contextLimit.toLocaleString()}), rotating session\n`)
			this.rotateSession()
		}
	}

	private detectCompaction(currentTotal: number): boolean {
		return this.prevTokenTotal > 0 && currentTotal < this.prevTokenTotal * 0.5
	}

	private rotateSession(): void {
		this.deps.resetSession()
		this.sessionId = null
		this.prevTokenTotal = 0
	}

	private async appendResult(response: string, ordinal: number): Promise<void> {
		const entry = response + "\n\n"
		this.summary += entry
		this.completedOrdinals.push(ordinal)

		if (this.config.outputPath) {
			await appendFile(this.config.outputPath, entry)
			process.stderr.write(`appended to ${this.config.outputPath}`)
		} else {
			process.stdout.write(response + "\n")
		}
	}

	private logUsage(usage: TokenUsage): void {
		const total = usage.input + usage.cacheRead
		const limitDisplay = this.config.contextLimit === Infinity ? this.config.modelContextLimit : this.config.contextLimit
		const pct = limitDisplay > 0 ? ((total / limitDisplay) * 100).toFixed(1) : "?"
		process.stderr.write(
			` | Tokens: ${usage.input.toLocaleString()} in / ${usage.output.toLocaleString()} out / ${usage.cacheRead.toLocaleString()} cache | Context: ${total.toLocaleString()} / ${limitDisplay.toLocaleString()} (${pct}%)`
		)
		process.stderr.write("\n")
	}

	destroy(): void {
		this.deps.destroyBook()
	}
}
