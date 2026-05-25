import { cli, define } from "gunshi"
import { openEpub } from "./epub/reader.ts"
import { opencodePlugin } from "./plugin/index.ts"
import summarizeCommand from "./command/summarize.ts"

const listCommand = define({
	name: "list",
	description: "List chapters in an epub file",
	args: {
		file: {
			type: "positional",
			required: true,
			description: "epub file path",
		},
	},
	run: async ctx => {
		const book = await openEpub(ctx.values.file)
		try {
			console.log(book.metadata.title)
			for (let i = 0; i < book.spine.length; i++) {
				console.log(`${i + 1}. ${book.spine[i].href}`)
			}
		} finally {
			book.destroy()
		}
	},
})

const readCommand = define({
	name: "read",
	description: "Read a chapter from an epub file",
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
		const ordinal = Number(ctx.values.chapter)
		const book = await openEpub(ctx.values.file)
		try {
			if (isNaN(ordinal) || ordinal < 1 || ordinal > book.spine.length) {
				console.error(`Invalid chapter ordinal: ${ctx.values.chapter}. Must be 1-${book.spine.length}`)
				process.exit(1)
			}
			const chapter = await book.loadChapter(book.spine[ordinal - 1].id)
			if (chapter) {
				process.stdout.write(chapter.html)
			}
		} finally {
			book.destroy()
		}
	},
})

const mainCommand = define({
	name: "sum-pub",
	description: "CLI tool to read chapters from epub files",
})

export default async function main() {
	await cli(process.argv.slice(2), mainCommand, {
		name: "sum-pub",
		version: "0.1.0",
		subCommands: {
			list: listCommand,
			read: readCommand,
			summarize: summarizeCommand,
		},
		plugins: [opencodePlugin()],
	})
}
