import { plugin } from "gunshi/plugin"
import { createOpencodeClient } from "@opencode-ai/sdk"
import type { OpencodeClient } from "@opencode-ai/sdk"

export const pluginId = "opencode" as const

export interface OpencodeExtension {
	client: OpencodeClient
}

export default function opencodePlugin() {
	return plugin<{}, typeof pluginId, [], OpencodeExtension>({
		id: pluginId,
		extension: () => {
			const client = createOpencodeClient()
			return { client }
		},
	})
}
