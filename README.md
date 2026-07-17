# delve

Look up English word definitions from [Merriam-Webster](https://www.merriam-webster.com).

```
╭── incubate  verb ──────────────────────────────────╮
│                                                    │
│  1. to sit on (eggs) so as to hatch by warmth      │
│  2. to maintain under conditions favorable for      │
│     hatching, development, or reaction              │
│                                                    │
│  Etymology: Latin incubatus, from incubare...       │
│                                                    │
│  Pronunciation: ˈiŋ-kyə-ˌbāt                        │
│  incubated; incubating                              │
╰────────────────────────────────────────────────────╯
```

## Install

```bash
pnpm install
pnpm build
```

Requires **Microsoft Edge** (used by Playwright to bypass M-W's bot protection). No separate browser download needed.

## Usage

### Single-shot lookup

```bash
pnpm dev <word>
# or after build:
pnpm start <word>
```

```
pnpm dev incubate
pnpm dev serendipity
pnpm dev ephemeral
```

### Interactive REPL

```bash
pnpm dev -i
```

Type words one at a time, results stay on screen. Type `q` to quit, `Esc` to exit.

### Flags

| Flag | Short | Effect |
|------|-------|--------|
| `--interactive` | `-i` | Start REPL mode |
| `--minimal` | `-m` | Definitions + pronunciation only (no etymology, examples) |
| `--full` | `-f` | Include synonyms and antonyms |
| `--refresh` | `-r` | Bypass cache, fetch fresh from M-W |

### Examples

```bash
# Minimal output — just the essentials
pnpm dev ephemeral -m

# Full output — includes synonyms & antonyms
pnpm dev beautiful -f

# Force a fresh fetch, ignore cache
pnpm dev incubate -r

# Interactive mode with full detail
pnpm dev -i -f
```

## How It Works

1. **Cache check** — looks in `~/.delve/cache/<word>.json` (TTL: 7 days). Instant if cached.
2. **Browser fetch** — on cache miss, Playwright launches Edge headless, navigates to `merriam-webster.com/dictionary/<word>`.
3. **Parse** — cheerio extracts headword, part of speech, definitions, pronunciations (IPA), inflections, etymology.
4. **Render** — Ink (React-on-terminal) displays the result in a styled box.
5. **Cache write** — result saved to disk for next time.

## Tech Stack

| Layer | Library |
|-------|---------|
| Runtime | Node.js + TypeScript (strict) |
| CLI args | commander |
| Browser | Playwright (Edge channel) |
| HTML parse | cheerio |
| Terminal UI | Ink + React |
| Dev runner | tsx |

## Cache

- Location: `~/.delve/cache/`
- TTL: 7 days
- Force refresh: `--refresh` flag
- Manual clear: `rm -rf ~/.delve/cache/`
