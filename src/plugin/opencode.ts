import { plugin } from "gunshi/plugin"
import { pluginId as epubPluginId } from "./epub.ts"
import type { EpubExtension } from "./types.ts"
import { pluginId as modelPluginId } from "./model.ts"
import type { ModelExtension } from "./types.ts"

export const pluginId = "opencode" as const

type DependencyExtensions = {
	[epubPluginId]: EpubExtension
	[modelPluginId]: ModelExtension
}

export default function opencodePlugin() {
	return plugin<DependencyExtensions, typeof pluginId, [typeof epubPluginId, typeof modelPluginId], import("./types.ts").OpencodeExtension>({
		id: pluginId,
		dependencies: [epubPluginId, modelPluginId],
		setup: ctx => {
			ctx.addGlobalOption("session", {
				type: "string",
				short: "s",
				description: "Resume existing session ID",
			})
			ctx.addGlobalOption("preseed", {
				type: "boolean",
				short: "P",
				description: "Include existing summary when resuming session",
			})
			ctx.addGlobalOption("prompt", {
				type: "string",
				short: "q",
				description: "Additional instructions for the summarization prompt",
			})
		},
		extension: async ctx => {
			const { client, providerID, modelID, contextLimit } = ctx.extensions[modelPluginId]
			const resumeSessionId = ctx.values.session as string | undefined
			const preseed = ctx.values.preseed as boolean | undefined
			const extraPrompt = ctx.values.prompt as string | undefined

			let sessionId: string | null = resumeSessionId ?? null

			const ensureSession = async (): Promise<string> => {
				if (sessionId) return sessionId
				const session = await client.session.create()
				sessionId = session.data?.id ?? null
				if (!sessionId) {
					throw new Error("Failed to create session")
				}
				process.stderr.write(`Session: ${sessionId}\n`)
				return sessionId
			}

			if (resumeSessionId) {
				process.stderr.write(`Session: ${sessionId} (resumed)\n`)
			}

			const summarize = async (html: string, chapterTitle: string, chapterOrdinal: number, existingSummary: string): Promise<import("./types.ts").SummarizeResult> => {
				const sid = await ensureSession()

			let prompt = ""
			if (existingSummary && (!resumeSessionId || preseed)) {
				prompt += `Here is a summary of the book so far. Continue in the same style and format (markdown with ## headings per chapter):\n\n${existingSummary}\n\n`
			}
			prompt += `Summarize the following chapter content. This is chapter ${chapterOrdinal} (${chapterTitle}). Use "## Chapter ${chapterOrdinal}" as the heading. Do not include any other commentary.\n\n`
			if (extraPrompt) {
				prompt += `Additional instructions: ${extraPrompt}\n\n`
			}
			prompt += html

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

			const getSessionUsage = async (): Promise<import("./types.ts").TokenUsage> => {
				if (!sessionId) {
					return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }
				}
				const messages = await client.session.messages({ path: { id: sessionId } })
				let lastInput = 0
				let totalOutput = 0
				let totalReasoning = 0
				let lastCacheRead = 0
				let lastCacheWrite = 0
				for (const msg of messages.data ?? []) {
					if (msg.info.role === "assistant" && "tokens" in msg.info) {
						const t = (msg.info as { tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } } }).tokens
						lastInput = t.input
						totalOutput += t.output
						totalReasoning += t.reasoning
						lastCacheRead = t.cache.read
						lastCacheWrite = t.cache.write
					}
				}
				return { input: lastInput, output: totalOutput, reasoning: totalReasoning, cacheRead: lastCacheRead, cacheWrite: lastCacheWrite }
			}

			return { contextLimit, sessionId, summarize, getSessionUsage, resetSession: () => { sessionId = null } }
		},
	})
}
