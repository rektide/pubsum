import { plugin } from "gunshi/plugin"
import { pluginId as epubPluginId } from "./epub.ts"
import type { EpubExtension } from "./epub.ts"
import { pluginId as modelPluginId } from "./model.ts"
import type { ModelExtension } from "./model.ts"

export const pluginId = "opencode" as const

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

type DependencyExtensions = {
	[epubPluginId]: EpubExtension
	[modelPluginId]: ModelExtension
}

export interface OpencodeExtension {
	contextLimit: number
	sessionId: string | null
	summarize: (html: string, chapterTitle: string, existingSummary: string) => Promise<SummarizeResult>
	getSessionUsage: () => Promise<TokenUsage>
}

export default function opencodePlugin() {
	return plugin<DependencyExtensions, typeof pluginId, [typeof epubPluginId, typeof modelPluginId], OpencodeExtension>({
		id: pluginId,
		dependencies: [epubPluginId, modelPluginId],
		extension: async ctx => {
			const { client, providerID, modelID, contextLimit } = ctx.extensions[modelPluginId]

			let sessionId: string | null = null

			const ensureSession = async (): Promise<string> => {
				if (sessionId) return sessionId
				const session = await client.session.create()
				sessionId = session.data?.id ?? null
				if (!sessionId) {
					throw new Error("Failed to create session")
				}
				return sessionId
			}

			const summarize = async (html: string, chapterTitle: string, existingSummary: string): Promise<SummarizeResult> => {
				const sid = await ensureSession()

				let prompt = ""
				if (existingSummary) {
					prompt += `Here is a summary of the book so far. Continue in the same style and format (markdown with ## headings per chapter):\n\n${existingSummary}\n\n`
				}
				prompt += `Summarize the following chapter content. Use a ## heading with the chapter title. Do not include any other commentary.\n\n${html}`

				const promptResponse = await client.session.prompt({
					path: { id: sid },
					body: {
						parts: [{ type: "text", text: prompt }],
						model: { providerID, modelID },
					},
				})

				const parts = promptResponse.data?.parts
				const response = parts
					?.filter(p => p.type === "text")
					.map(p => ("text" in p ? String(p.text) : ""))
					.join("\n") ?? ""

				const usage = await getSessionUsage()
				return { response, usage }
			}

			const getSessionUsage = async (): Promise<TokenUsage> => {
				if (!sessionId) {
					return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }
				}
				const messages = await client.session.messages({ path: { id: sessionId } })
				const usage: TokenUsage = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }
				for (const msg of messages.data ?? []) {
					if (msg.info.role === "assistant" && "tokens" in msg.info) {
						const t = (msg.info as { tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } } }).tokens
						usage.input += t.input
						usage.output += t.output
						usage.reasoning += t.reasoning
						usage.cacheRead += t.cache.read
						usage.cacheWrite += t.cache.write
					}
				}
				return usage
			}

			return { contextLimit, sessionId, summarize, getSessionUsage }
		},
	})
}
