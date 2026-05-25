#!/usr/bin/env node
import { realpath } from "node:fs/promises"

realpath(process.argv[1]).then(resolved => {
	if (resolved === import.meta.filename) {
		import("./sum-pub.main.ts").then(m => m.main())
	}
})
