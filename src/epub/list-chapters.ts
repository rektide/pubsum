import type { EpubBook, EpubToc } from "./reader.ts"
import type { PageList } from "@lingo-reader/epub-parser"

export function buildTocLabelMap(toc: EpubToc): Map<string, string> {
	const map = new Map<string, string>()
	const walk = (entries: EpubToc) => {
		for (const entry of entries) {
			const href = entry.href.split("#")[0]
			map.set(href, entry.label)
			if (entry.children) walk(entry.children)
		}
	}
	walk(toc)
	return map
}

function buildPageMap(pageList: PageList): Map<string, string[]> {
	const map = new Map<string, string[]>()
	for (const pt of pageList.pageTargets) {
		const href = pt.href.split("#")[0]
		let pages = map.get(href)
		if (!pages) {
			pages = []
			map.set(href, pages)
		}
		pages.push(pt.value)
	}
	return map
}

export function listChapters(book: EpubBook): void {
	const tocLabels = buildTocLabelMap(book.toc)
	const pageMap = book.pageList?.pageTargets?.length
		? buildPageMap(book.pageList)
		: new Map<string, string[]>()

	for (let i = 0; i < book.spine.length; i++) {
		const spineItem = book.spine[i]
		const href = spineItem.href
		const tocLabel = tocLabels.get(href) ?? tocLabels.get(href.split("/").pop() ?? "")
		const hrefLabel = href.split("/").pop()?.replace(/\.[^.]+$/, "") ?? `Chapter ${i + 1}`
		const title = tocLabel ?? hrefLabel
		const flags: string[] = []
		if (spineItem.properties) flags.push(spineItem.properties)
		if (spineItem.linear === "no") flags.push("non-linear")
		const pages = pageMap.get(href)
		const pageInfo = pages?.length ? ` (${pages.length}p)` : ""
		const flagStr = flags.length ? ` [${flags.join(", ")}]` : ""
		process.stdout.write(`  ${i + 1}. ${title}${flagStr}${pageInfo}\n`)
	}
}
