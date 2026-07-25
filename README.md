# delve-dict

Look up English word definitions from [Merriam-Webster](https://www.merriam-webster.com).

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/delve-dict)](https://www.npmjs.com/package/delve-dict)

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
npm install -g delve-dict
```

Requires a browser for Playwright (used to bypass M-W's bot protection):

- **Windows/macOS**: Google Chrome or Microsoft Edge (auto-detected)
- **Linux / WSL2**: run `npx playwright install chromium` after install

### From source

```bash
git clone https://github.com/xiaoshaoning/delve-dict.git
cd delve-dict
pnpm install
pnpm build
pnpm link --global

## Usage

### Single-shot lookup

```bash
delve <word>
```

```
delve incubate
delve serendipity
delve ephemeral
```

### Interactive REPL

```bash
delve -i
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
delve ephemeral -m

# Full output — includes synonyms & antonyms
delve beautiful -f

# Force a fresh fetch, ignore cache
delve incubate -r

# Interactive mode with full detail
delve -i -f
```

## How It Works

1. **Cache check** — looks in `~/.delve/cache/<word>.json` (TTL: 7 days). Instant if cached.
2. **Browser fetch** — on cache miss, Playwright launches a headless browser (Chrome → Edge → Chromium), navigates to `merriam-webster.com/dictionary/<word>`.
3. **Parse** — cheerio extracts headword, part of speech, definitions, pronunciations (IPA), inflections, etymology.
4. **Render** — Ink (React-on-terminal) displays the result in a styled box.
5. **Cache write** — result saved to disk for next time.

## Tech Stack

| Layer | Library |
|-------|---------|
| Runtime | Node.js + TypeScript (strict) |
| CLI args | commander |
| Browser | Playwright (Chrome → Edge → Chromium) |
| HTML parse | cheerio |
| Terminal UI | Ink + React |
| Dev runner | tsx |

## Cache

- Location: `~/.delve/cache/`
- TTL: 7 days
- Force refresh: `--refresh` flag
- Manual clear: `rm -rf ~/.delve/cache/`
