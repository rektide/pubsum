import { plugin } from "gunshi/plugin"
import { createOpencodeClient } from "@opencode-ai/sdk"
import type { OpencodeClient } from "@opencode-ai/sdk"

export const pluginId = "model" as const

export interface ModelExtension {
	client: OpencodeClient
	providerID: string
	modelID: string
}

function pad(str: string, len: number, char = " "): string {
	return str.length >= len ? str : str + char.repeat(len - str.length)
}

function formatProviders(providers: Array<{ id: string; name: string; models: Record<string, unknown> }>): string {
	const idWidth = Math.max(3, ...providers.map(p => p.id.length))
	const nameWidth = Math.max(4, ...providers.map(p => p.name.length))
	const modelsWidth = 6

	const header = `${pad("ID", idWidth)}  ${pad("Name", nameWidth)}  ${pad("Models", modelsWidth)}`
	const sep = `${pad("", idWidth, "-")}  ${pad("", nameWidth, "-")}  ${pad("", modelsWidth, "-")}`
	const rows = providers.map(p =>
		`${pad(p.id, idWidth)}  ${pad(p.name, nameWidth)}  ${String(Object.keys(p.models).length)}`
	)
	return [header, sep, ...rows].join("\n")
}

function formatModels(providers: Array<{ id: string; models: Record<string, { id: string; name: string; limit: { context: number; output: number }; cost: { input: number; output: number } }> }>): string {
	const allModels = providers.flatMap(p =>
		Object.values(p.models).map(m => ({
			providerID: p.id,
			id: m.id,
			name: m.name,
			context: m.limit.context,
			output: m.limit.output,
			costInput: m.cost.input,
			costOutput: m.cost.output,
		}))
	)

	const slugWidth = Math.max(16, ...allModels.map(m => `${m.providerID}/${m.id}`.length))
	const nameWidth = Math.max(4, ...allModels.map(m => m.name.length))
	const ctxWidth = 7
	const outWidth = 6
	const costInWidth = 9
	const costOutWidth = 10

	const header = [
		pad("Provider/Model", slugWidth),
		pad("Name", nameWidth),
		pad("Context", ctxWidth),
		pad("Output", outWidth),
		pad("Cost In", costInWidth),
		pad("Cost Out", costOutWidth),
	].join("  ")
	const sep = [
		pad("", slugWidth, "-"),
		pad("", nameWidth, "-"),
		pad("", ctxWidth, "-"),
		pad("", outWidth, "-"),
		pad("", costInWidth, "-"),
		pad("", costOutWidth, "-"),
	].join("  ")
	const rows = allModels.map(m => [
		pad(`${m.providerID}/${m.id}`, slugWidth),
		pad(m.name, nameWidth),
		pad(String(m.context), ctxWidth),
		pad(String(m.output), outWidth),
		pad(`$${m.costInput}/M`, costInWidth),
		pad(`$${m.costOutput}/M`, costOutWidth),
	].join("  "))
	return [header, sep, ...rows].join("\n")
}

export default function modelPlugin() {
	return plugin<{}, typeof pluginId, [], ModelExtension>({
		id: pluginId,
		setup: ctx => {
			ctx.addGlobalOption("listProviders", {
				type: "boolean",
				short: "l",
				description: "List available providers and exit",
			})
			ctx.addGlobalOption("listModels", {
				type: "boolean",
				short: "m",
				description: "List available models with context limits and exit",
			})
			ctx.addGlobalOption("provider", {
				type: "string",
				short: "p",
				description: "Provider ID to use",
			})
			ctx.addGlobalOption("model", {
				type: "string",
				short: "M",
				description: "Model ID to use",
			})
		},
		extension: async ctx => {
			const client = createOpencodeClient({ baseUrl: "http://localhost:4096" })
			const providersResponse = await client.config.providers()
			const providers = providersResponse.data?.providers
			if (!providers?.length) {
				throw new Error("No providers available")
			}

			if (ctx.values.listProviders) {
				process.stdout.write(formatProviders(providers) + "\n")
				process.exit(0)
			}

			if (ctx.values.listModels) {
				process.stdout.write(formatModels(providers) + "\n")
				process.exit(0)
			}

			const providerArg = ctx.values.provider as string | undefined
			const modelArg = ctx.values.model as string | undefined

			const provider = providerArg
				? providers.find(p => p.id === providerArg)
				: providers[0]

			if (!provider) {
				throw new Error(`Provider not found: ${providerArg}`)
			}

			const models = Object.values(provider.models)
			if (!models.length) {
				throw new Error(`No models available for provider: ${provider.id}`)
			}

			const model = modelArg
				? models.find(m => m.id === modelArg)
				: models[0]

			if (!model) {
				throw new Error(`Model not found: ${modelArg} for provider: ${provider.id}`)
			}

			return {
				client,
				providerID: provider.id,
				modelID: model.id,
			}
		},
	})
}
