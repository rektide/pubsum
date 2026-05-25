import { plugin } from "gunshi/plugin"
import { createOpencodeClient } from "@opencode-ai/sdk"
import type { OpencodeClient } from "@opencode-ai/sdk"
import { pluginId as epubPluginId } from "./epub.ts"
import type { EpubExtension } from "./epub.ts"

export const pluginId = "opencode" as const

type DependencyExtensions = {
	[epubPluginId]: EpubExtension
}

export interface OpencodeExtension {
	client: OpencodeClient
	response: string
}

export default function opencodePlugin() {
	return plugin<DependencyExtensions, typeof pluginId, [typeof epubPluginId], OpencodeExtension>({
		id: pluginId,
		dependencies: [epubPluginId],
		extension: async ctx => {
			const html = ctx.extensions[epubPluginId].html
			const client = createOpencodeClient({ baseUrl: "http://localhost:54321" })

			const providersResponse = await client.config.providers()
			const providers = providersResponse.data?.providers
			if (!providers?.length) {
				throw new Error("No providers available")
			}

			const provider = providers[0]
			const modelId = Object.keys(provider.models)[0]
			if (!modelId) {
				throw new Error("No models available")
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
						providerID: provider.id,
						modelID: modelId,
					},
				},
			})

			const parts = promptResponse.data?.parts
			const response = parts
				?.filter(p => p.type === "text")
				.map(p => ("text" in p ? String(p.text) : ""))
				.join("\n") ?? ""

			return { client, response }
		},
	})
}
