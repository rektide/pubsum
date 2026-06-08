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

type DependencyExtensions = {
	[epubPluginId]: EpubExtension
	[modelPluginId]: ModelExtension
}

export interface OpencodeExtension {
	response: string
	usage: TokenUsage | null
	contextLimit: number
}

export default function opencodePlugin() {
	return plugin<DependencyExtensions, typeof pluginId, [typeof epubPluginId, typeof modelPluginId], OpencodeExtension>({
		id: pluginId,
		dependencies: [epubPluginId, modelPluginId],
		extension: async ctx => {
			const html = ctx.extensions[epubPluginId].html
			const { client, providerID, modelID, contextLimit } = ctx.extensions[modelPluginId]
			if (!html) {
				return { client, response: "", usage: null, contextLimit }
			}

			const session = await client.session.create()
			const sessionId = session.data?.id
			if (!sessionId) {
				throw new Error("Failed to create session")
			}

			const promptResponse = await client.session.prompt({
				path: { id: sessionId },
				body: {
					parts: [
						{
							type: "text",
							text: `Please summarize the following chapter content:\n\n${html}`,
						},
					],
					model: {
						providerID,
						modelID,
					},
				},
			})

			const parts = promptResponse.data?.parts
			const response = parts
				?.filter(p => p.type === "text")
				.map(p => ("text" in p ? String(p.text) : ""))
				.join("\n") ?? ""

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

			return { response, usage, contextLimit }
		},
	})
}
