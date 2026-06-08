import { plugin } from "gunshi/plugin"
import { pluginId as epubPluginId } from "./epub.ts"
import type { EpubExtension } from "./epub.ts"
import { pluginId as modelPluginId } from "./model.ts"
import type { ModelExtension } from "./model.ts"

export const pluginId = "opencode" as const

type DependencyExtensions = {
	[epubPluginId]: EpubExtension
	[modelPluginId]: ModelExtension
}

export interface OpencodeExtension {
	response: string
}

export default function opencodePlugin() {
	return plugin<DependencyExtensions, typeof pluginId, [typeof epubPluginId, typeof modelPluginId], OpencodeExtension>({
		id: pluginId,
		dependencies: [epubPluginId, modelPluginId],
		extension: async ctx => {
			const html = ctx.extensions[epubPluginId].html
			if (!html) {
				return { client: ctx.extensions[modelPluginId].client, response: "" }
			}
			const { client, providerID, modelID } = ctx.extensions[modelPluginId]

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

			return { response }
		},
	})
}
