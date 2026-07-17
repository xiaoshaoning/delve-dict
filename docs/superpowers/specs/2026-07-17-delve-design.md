# delve — Design Spec

**Date:** 2026-07-17
**Status:** approved

## Overview

A TypeScript CLI application that looks up English word definitions from Merriam-Webster (m-w.com). Fetches the dictionary page (e.g., `https://www.merriam-webster.com/dictionary/incubate`) using Playwright (to bypass bot protection), parses the HTML with cheerio into a structured `WordData` object, caches results locally with a 7-day TTL, and renders output in the terminal using Ink (React-on-terminal).

## Usage Modes

- **Single-shot (default):** `delve incubate` — fetches, renders, exits.
- **Interactive REPL:** `delve -i` / `delve --interactive` — starts a session; type words one at a time, quit with `q` or Ctrl+C.
- **Detail flags:**
  - Default = standard detail (definitions, examples, etymology, first known use)
  - `-m` / `--minimal` = definitions + pronunciation only
  - `-f` / `--full` = full detail (includes synonyms, antonyms)
- **Cache control:** `-r` / `--refresh` forces a live fetch, bypassing the cache.

## Architecture

Three-layer design, each independently testable:

```
CLI args (commander)
       │
       ▼
Fetch layer — cache check → Playwright fetch → cheerio parse → WordData
       │
       ▼
Render layer — Ink React components → terminal
```

### Layer 1: Fetch & Parse

1. Check TTL cache (`~/.delve/cache/<word>.json`). If cache entry exists and is younger than 7 days (and `--refresh` is not set), return it immediately.
2. Cache miss → launch Playwright headless browser, navigate to `https://www.merriam-webster.com/dictionary/<word>`.
3. Wait for the definition content to appear (CSS selector).
4. Extract full HTML, parse with cheerio into a typed `WordData` object.
5. Write `WordData` to cache with timestamp.
6. Return `WordData` to the render layer.

### Layer 2: Render

Ink React components render the `WordData` to the terminal:

- **`<App>`** — top-level: single-shot wraps `<LookupResult>`, REPL mode wraps `<ReplShell>`.
- **`<ReplShell>`** — REPL: input prompt, spinner during fetch, last result displayed, status bar.
- **`<LookupResult>`** — renders a single word entry with box border, styled sections for pronunciation, inflections, definitions, etymology, etc.
- **`<Spinner>`** — shown during Playwright fetch with "Looking up '<word>'..."

Ink formatting (bold, colors, borders) degrades gracefully to plain text when stdout is not a TTY (piped/redirected).

### Layer 3: CLI

Uses `commander` for argument parsing. Handles `-i`, `-m`, `-f`, `-r`, and the word argument.

## Data Model

```typescript
interface WordData {
  headword: string;
  functionalLabel: string;        // "verb", "noun", "adjective" ...
  pronunciations: Pronunciation[];
  inflections: Inflection[];
  definitions: DefinitionGroup[];
  etymology?: string;
  firstKnownUse?: string;
  synonyms?: string[];
  antonyms?: string[];
  examples?: string[];
}

interface Pronunciation {
  text: string;                   // "ˈin-kyə-ˌbāt"
  label?: string;                 // "incubates" | undefined for headword
}

interface Inflection {
  form: string;                   // "incubated"
  label: string;                  // "past tense"
}

interface DefinitionGroup {
  divider?: string;               // "transitive verb" sense divider
  entries: DefinitionEntry[];
}

interface DefinitionEntry {
  number: string;                 // "1", "2a", "3b(1)"
  text: string;
  examples?: string[];
}
```

## UI Layout

```
╭── incubate  verb ──────────────────────────────────╮
│                                                    │
│  Pronunciation: ˈin-kyə-ˌbāt                        │
│  incubates: ˈin-kyə-ˌbāts                           │
│  incubated: ˈin-kyə-ˌbā-təd                          │
│                                                    │
│  transitive verb                                    │
│    1. to sit on (eggs) so as to hatch by warmth     │
│    2. to maintain under favorable conditions        │
│       ► "incubating bacterial cultures"              │
│                                                    │
│  Etymology: Latin incubatus, from incubare...       │
│  First known use: 1641                              │
│                                                    │
│  ?help  ↑↓scroll  q quit                            │
╰────────────────────────────────────────────────────╯
```

Detail flags control section visibility:
- `--minimal`: only pronunciations, inflections, definitions (no examples/etymology/firstKnownUse)
- `--full`: adds synonyms/antonyms sections

## Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js + TypeScript (strict) |
| CLI parsing | `commander` |
| Browser fetch | `playwright` |
| HTML parsing | `cheerio` |
| Terminal UI | `ink` + `react` |
| Build | `tsx` for dev, `tsc` for build |
| Package manager | pnpm |

## Project Structure

```
word/
├── src/
│   ├── index.ts              # CLI entry point, commander setup
│   ├── fetch/
│   │   ├── cache.ts          # TTL cache read/write/invalidate
│   │   ├── browser.ts        # Playwright page fetch
│   │   └── parser.ts         # cheerio HTML → WordData
│   ├── render/
│   │   ├── app.tsx           # <App> top-level component
│   │   ├── repl.tsx          # <ReplShell> interactive mode
│   │   ├── lookup-result.tsx # <LookupResult> single entry display
│   │   └── spinner.tsx       # <Spinner> fetch indicator
│   └── types.ts              # WordData, Pronunciation, etc.
├── tsconfig.json
├── package.json
└── README.md
```

## Error Handling

| Scenario | Behavior |
|---|---|
| Word not found (404/empty results) | `⚠ No results for "asdfgh".` Show spelling suggestions if available. |
| Network timeout / connection error | `✖ Could not reach Merriam-Webster. Check your connection.` Exit code 1. |
| Bot protection (403) | Retry once with longer wait. Still blocked → `✖ Blocked by M-W security. Try again in a moment.` |
| Typo → redirect (e.g., "incubat" → "incubate") | Follow redirect, display "Showing results for: incubate" at top of result. |
| Cache file I/O error | Silently skip, fetch live. Corrupt file → delete it, re-fetch. |
| Multiple homograph entries (e.g., "lead") | Show each as separate `<LookupResult>` with `¹lead`, `²lead` numbering. |
| stdout not a TTY (pipe/redirect) | Strip Ink formatting, output plain text. |
| HTML structure changes (parser misses an element) | Missing elements → `undefined`, render skips empty sections (no crash). |

## Key Design Decisions

1. **Playwright required** — M-W serves a JS challenge (403) to simple HTTP requests. A headless browser is the only reliable way through.
2. **Cache-first** — 7-day TTL cache means most lookups are instant. Only the first lookup per word incurs the ~3s browser cost.
3. **Ink over plain text** — richer UX (spinners, styled sections, box borders) but degrades cleanly to plain text when piped.
4. **Monolithic process** — single process for v1. No browser daemon complexity. The cache makes cold starts rare enough.
5. **Defensive parsing** — cheerio selectors for specific M-W CSS classes, but every extraction is nullable. M-W can change their HTML; we degrade rather than crash.
