import { define } from "gunshi"
import { openEpub } from "../epub/reader.ts"
import { pluginId } from "../plugin/opencode.ts"
import type { OpencodeExtension } from "../plugin/opencode.ts"

type Extensions = {
	[pluginId]: OpencodeExtension
}

const summarizeCommand = define<{
	extensions: Extensions
}>({
	name: "summarize",
	description: "Summarize a chapter from an epub file using opencode",
	args: {
		file: {
			type: "positional",
			required: true,
			description: "epub file path",
		},
		chapter: {
			type: "positional",
			required: true,
			description: "chapter ordinal",
		},
	},
	run: async ctx => {
		const file = ctx.values.file as string
		const ordinal = Number(ctx.values.chapter)
		const book = await openEpub(file)
		let html: string | undefined
		try {
			if (isNaN(ordinal) || ordinal < 1 || ordinal > book.spine.length) {
				console.error(`Invalid chapter ordinal: ${ctx.values.chapter}. Must be 1-${book.spine.length}`)
				process.exit(1)
			}
			const chapter = await book.loadChapter(book.spine[ordinal - 1].id)
			html = chapter?.html
		} finally {
			book.destroy()
		}

		if (!html) {
			console.error("Failed to load chapter content")
			process.exit(1)
		}

		const client = ctx.extensions[pluginId].client

		const providersResponse = await client.config.providers()
		const providers = providersResponse.data?.providers
		if (!providers?.length) {
			console.error("No providers available")
			process.exit(1)
		}

		const provider = providers[0]
		const modelId = Object.keys(provider.models)[0]
		if (!modelId) {
			console.error("No models available")
			process.exit(1)
		}

		const session = await client.session.create()
		const sessionId = session.data?.id
		if (!sessionId) {
			console.error("Failed to create session")
			process.exit(1)
		}

		await client.session.prompt({
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
	},
})

export default summarizeCommand
