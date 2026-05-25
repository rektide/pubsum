import { openEpub } from "./epub/reader.ts"

export async function main() {
	const filePath = process.argv[2]

	if (!filePath) {
		console.error("Usage: sum-pub <epub-file> [chapter-ordinal]")
		process.exit(1)
	}

	const book = await openEpub(filePath)

	try {
		const chapterArg = process.argv[3]

		if (!chapterArg) {
			console.log(book.metadata.title)
			for (let i = 0; i < book.spine.length; i++) {
				console.log(`${i + 1}. ${book.spine[i].href}`)
			}
		} else {
			const ordinal = Number(chapterArg)
			if (isNaN(ordinal) || ordinal < 1 || ordinal > book.spine.length) {
				console.error(`Invalid chapter ordinal: ${chapterArg}. Must be 1-${book.spine.length}`)
				process.exit(1)
			}

			const chapter = await book.loadChapter(book.spine[ordinal - 1].id)
			if (chapter) {
				process.stdout.write(chapter.html)
			}
		}
	} finally {
		book.destroy()
	}
}
