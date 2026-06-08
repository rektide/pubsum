# sum-pub

Summarize epub chapters using opencode. Each chapter's summary is fed back as context for the next, so the LLM maintains narrative continuity across the whole book. Output appends to a markdown file, building a running chapter-by-chapter summary.

## usage

```bash
# summarize a single chapter
node src/sum-pub.ts -f book.epub -c 5

# summarize multiple chapters (range, list, or both)
node src/sum-pub.ts -f book.epub -c 5-8
node src/sum-pub.ts -f book.epub -c 5,7,9

# write output to a markdown file (appends)
node src/sum-pub.ts -f book.epub -c 5-12 -o summaries.md

# choose provider and model
node src/sum-pub.ts -f book.epub -c 5 -p openrouter -M deepseek/deepseek-v4-pro

# set a proactive context limit for session rotation
node src/sum-pub.ts -f book.epub -c 5-20 -L 40000 -o summaries.md

# resume an existing session
node src/sum-pub.ts -f book.epub -c 10-12 -s <session-id> -o summaries.md

# resume with preseed (include existing summary in prompt)
node src/sum-pub.ts -f book.epub -c 10-12 -s <session-id> --preseed -o summaries.md

# list connected providers and their defaults
node src/sum-pub.ts --list-providers

# list all models with context limits and cost
node src/sum-pub.ts --list-models
```

## flags

| flag | short | description |
|------|-------|-------------|
| `--file` | `-f` | epub file path |
| `--chapters` | `-c` | chapter(s): single (`5`), range (`5-8`), or list (`5,6,7`) |
| `--output` | `-o` | append summaries to markdown file |
| `--provider` | `-p` | provider ID to use |
| `--model` | `-M` | model ID to use |
| `--context-limit` | `-L` | token limit before session rotation (default: none, reactive only) |
| `--session` | `-s` | resume existing session ID |
| `--preseed` | `-P` | include existing summary when resuming session |
| `--list-providers` | `-l` | list connected providers and exit |
| `--list-models` | `-m` | list models with context limits and cost |

## how it works

Three gunshi plugins feed into a `SumPubState` loop:

1. **epub plugin** — opens the book, provides `loadChapter(ordinal)`, reads existing output file as seed summary
2. **model plugin** — discovers providers/models from opencode, selects one (or falls back to first connected provider's default)
3. **opencode plugin** — creates an opencode session, sends chapter content for summarization, tracks token usage

The main loop iterates through chapter ordinals. For each chapter:
- load chapter HTML from the epub
- send to opencode for summarization (seeded with accumulated summary so far)
- detect compaction (if token count drops >50%, the session was auto-compacted — redo in fresh session)
- catch errors and retry in a new session
- check proactive limit if `-L` is set
- append result to output file and in-memory summary

## session management

Sessions persist across runs. Use `-s` to resume:

```bash
# first batch — note the session ID in stderr
node src/sum-pub.ts -f book.epub -c 5-8 -o out.md
# Session: ses_abc123...

# continue in the same session
node src/sum-pub.ts -f book.epub -c 9-12 -s ses_abc123... -o out.md
```

Without `-s`, a new session is created each run.

## context and compaction

opencode auto-compacts sessions when they get large (summarizes the conversation internally). This causes a sudden drop in token count. sum-pub detects this and redoes the affected chapter in a fresh session seeded with the in-memory summary.

With `-L`, you can set a proactive token limit to rotate before compaction happens. Without `-L`, sessions grow until the model compacts or accepts the oversized context.

## architecture

```
src/
  cli.ts              gunshi CLI entry, main loop
  sum-pub/
    state.ts          SumPubState class (summary, session, compaction, output)
  epub/
    reader.ts         wraps @lingo-reader/epub-parser
  plugin/
    epub.ts           gunshi plugin: book loading, chapter args, output file
    model.ts          gunshi plugin: provider/model discovery and selection
    opencode.ts       gunshi plugin: opencode session, summarization, token tracking
```
