# Word Lookup CLI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript CLI that looks up English word definitions from Merriam-Webster using Playwright + cheerio + Ink.

**Architecture:** Three layers — fetch (cache → Playwright → cheerio → WordData), render (Ink React components), CLI (commander args). Cache-first with 7-day TTL at `~/.wordlookup/cache/`.

**Tech Stack:** TypeScript (strict), pnpm, commander, playwright, cheerio, ink, react, tsx, os, fs/promises

**Source tree:**
```
src/
├── index.ts              # CLI entry, commander
├── types.ts              # WordData & friends
├── fetch/
│   ├── cache.ts          # TTL cache read/write
│   ├── browser.ts        # Playwright page fetch
│   └── parser.ts         # cheerio HTML → WordData
└── render/
    ├── app.tsx           # <App>
    ├── repl.tsx          # <ReplShell>
    ├── lookup-result.tsx # <LookupResult>
    └── spinner.tsx       # <Spinner>
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "wordlookup",
  "version": "1.0.0",
  "description": "English word lookup via Merriam-Webster",
  "type": "module",
  "bin": {
    "wordlookup": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "commander": "^12.1.0",
    "ink": "^5.0.1",
    "ink-text-input": "^6.0.0",
    "playwright": "^1.48.0",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Write .gitignore**

```
node_modules/
dist/
.cache/
```

- [ ] **Step 4: Install dependencies + install Playwright browsers**

```bash
pnpm install
npx playwright install chromium
```

Expected: both commands succeed with exit code 0.

- [ ] **Step 5: Create src/ directory structure**

```bash
mkdir -p src/fetch src/render
```

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json .gitignore
git commit -m "chore: scaffold project with pnpm + TypeScript + deps"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
export interface WordData {
  headword: string;
  functionalLabel: string;
  pronunciations: Pronunciation[];
  inflections: Inflection[];
  definitions: DefinitionGroup[];
  etymology?: string;
  firstKnownUse?: string;
  synonyms?: string[];
  antonyms?: string[];
  examples?: string[];
}

export interface Pronunciation {
  text: string;
  label?: string;
}

export interface Inflection {
  form: string;
  label: string;
}

export interface DefinitionGroup {
  divider?: string;
  entries: DefinitionEntry[];
}

export interface DefinitionEntry {
  number: string;
  text: string;
  examples?: string[];
}

export type DetailLevel = 'minimal' | 'standard' | 'full';

export interface CacheEntry {
  cachedAt: number;
  data: WordData;
}
```

- [ ] **Step 2: Verify types compile**

```bash
pnpm typecheck
```

Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core WordData types"
```

---

### Task 3: TTL Cache Module

**Files:**
- Create: `src/fetch/cache.ts`

- [ ] **Step 1: Write cache.ts**

```typescript
import { join } from 'node:path';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import type { CacheEntry, WordData } from '../types.js';

const CACHE_DIR = join(homedir(), '.wordlookup', 'cache');
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cachePath(word: string): string {
  return join(CACHE_DIR, `${encodeURIComponent(word.toLowerCase())}.json`);
}

export async function readCache(word: string): Promise<WordData | null> {
  try {
    const raw = await readFile(cachePath(word), 'utf-8');
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt < TTL_MS) {
      return entry.data;
    }
    // expired — delete it
    await unlink(cachePath(word)).catch(() => {});
    return null;
  } catch {
    return null;
  }
}

export async function writeCache(word: string, data: WordData): Promise<void> {
  const entry: CacheEntry = { cachedAt: Date.now(), data };
  const filePath = cachePath(word);
  try {
    // recursively create cache dir, ignore if exists
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  } catch {
    // cache write failure is non-fatal — silently skip
  }
}
```

- [ ] **Step 2: Verify compiles**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/fetch/cache.ts
git commit -m "feat: add TTL file cache (7-day)"
```

---

### Task 4: Browser Fetch Module

**Files:**
- Create: `src/fetch/browser.ts`

- [ ] **Step 1: Write browser.ts**

```typescript
import { chromium, type Browser, type Page } from 'playwright';

const M_W_BASE = 'https://www.merriam-webster.com/dictionary/';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function fetchPage(word: string): Promise<{ html: string; finalUrl: string }> {
  const url = M_W_BASE + encodeURIComponent(word);
  const browser = await getBrowser();

  for (let attempt = 0; attempt < 2; attempt++) {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    });
    const page: Page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      // wait for definition content or "no results" to appear
      await page
        .waitForSelector('.hword, .no-results, [data-entry]', { timeout: 10_000 })
        .catch(() => {
          // if neither appears, try waiting a bit more for JS challenge
        });

      // if we hit the security page, wait and retry
      const bodyText = await page.textContent('body');
      if (bodyText?.includes('security service') || bodyText?.includes('verifying')) {
        await page.waitForTimeout(3000);
        await context.close();
        continue; // retry once
      }

      const html = await page.content();
      const finalUrl = page.url();
      await context.close();
      return { html, finalUrl };
    } catch (err) {
      await context.close().catch(() => {});
      throw err;
    }
  }

  throw new Error('Blocked by Merriam-Webster security. Try again in a moment.');
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}
```

- [ ] **Step 2: Verify compiles**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/fetch/browser.ts
git commit -m "feat: add Playwright browser fetch with retry"
```

---

### Task 5: HTML Parser

**Files:**
- Create: `src/fetch/parser.ts`

This is the most complex module — it must defensively extract from M-W's HTML. Selectors are based on M-W's known structure; every extraction is wrapped in try/catch or null-coalescing.

- [ ] **Step 1: Write parser.ts**

```typescript
import * as cheerio from 'cheerio';
import type { WordData, Pronunciation, Inflection, DefinitionGroup, DefinitionEntry } from '../types.js';

/**
 * Parse Merriam-Webster dictionary HTML into a WordData object.
 * Every extraction is defensive — M-W may change their markup at any time.
 */
export function parseHtml(html: string, finalUrl: string): WordData | null {
  const $ = cheerio.load(html);

  // ---- headword ----
  const headword = $('.hword').first().text().trim() || $('meta[name="title"]').attr('content')?.trim() || 'unknown';

  if (headword === 'unknown' && !$('.dtText').length) {
    return null; // no definition content found — likely "word not found" page
  }

  // ---- functional label (part of speech) ----
  const functionalLabel = $('.fl').first().text().trim() || $('.ps').first().text().trim() || '';

  // ---- pronunciations ----
  const pronunciations: Pronunciation[] = [];
  $('.prs .pr, .prs .pron, .pr').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text && text.length < 200) {
      pronunciations.push({ text });
    }
  });
  // also try the simpler structure: a single .pron-rows or the content after "pronunciation:"
  if (pronunciations.length === 0) {
    $('.pron-row, .pronunciation-entry').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text && text.length < 200) {
        pronunciations.push({ text });
      }
    });
  }

  // ---- inflections (verb conjugations, plurals) ----
  const inflections: Inflection[] = [];
  $('.vg .vg-ins, .vi .vi-in, .in-more').each((_, el) => {
    const form = $(el).find('.if, .inf-form').first().text().trim();
    const label = $(el).find('.il, .inf-label').first().text().trim();
    if (form) {
      inflections.push({ form, label: label || '' });
    }
  });

  // ---- definitions ----
  const definitions: DefinitionGroup[] = [];
  // M-W groups definitions under sense blocks with class .sb-0, .sb-1, etc.
  const senseBlocks = $('.sb-0, .sb-1, .sb-2, .sb-3, .sb-entry, .vg-sseq-entry-item');

  if (senseBlocks.length === 0) {
    // fallback: single flat list
    const entries: DefinitionEntry[] = [];
    $('.dtText').each((_, el) => {
      const raw = $(el).text().replace(/\s+/g, ' ').trim();
      const match = raw.match(/^:?\s*(.+)$/);
      if (match) {
        entries.push({ number: `${entries.length + 1}`, text: match[1] });
      }
    });
    if (entries.length > 0) {
      definitions.push({ entries });
    }
  } else {
    senseBlocks.each((_, block) => {
      const divider = $(block).find('.dt, .sl, .sensus').first().text().trim() || undefined;
      const entries: DefinitionEntry[] = [];

      $(block).find('.dtText, .dt').each((i, el) => {
        const raw = $(el).text().replace(/\s+/g, ' ').trim();
        // definition texts often start with ": " — strip that
        const cleaned = raw.replace(/^:\s*/, '');
        if (cleaned) {
          const numberMatch = cleaned.match(/^(\d+[a-z]?(?:\(\d+\))?)\s+(.+)$/);
          const entry: DefinitionEntry = numberMatch
            ? { number: numberMatch[1], text: numberMatch[2] }
            : { number: `${i + 1}`, text: cleaned };

          // look for usage examples inside this definition entry
          const examples: string[] = [];
          $(el).find('.ex-sent, .ure').each((_, ex) => {
            const exText = $(ex).text().replace(/\s+/g, ' ').trim();
            if (exText) examples.push(exText);
          });
          if (examples.length > 0) entry.examples = examples;

          entries.push(entry);
        }
      });

      if (entries.length > 0) {
        definitions.push({ divider, entries });
      }
    });
  }

  // ---- etymology ----
  const etymology = $('.et').first().text().replace(/\s+/g, ' ').trim()
    || $('.word-origin').first().text().replace(/\s+/g, ' ').trim()
    || undefined;

  // ---- first known use ----
  const firstKnownUse = $('.first-use-date').first().text().trim()
    || $('.first-use').first().text().trim()
    || undefined;

  // ---- synonyms ----
  const synonyms: string[] = [];
  $('.syn-list a, .thes-list a, .synonyms-list a').each((_, el) => {
    const s = $(el).text().trim();
    if (s) synonyms.push(s);
  });

  // ---- antonyms ----
  const antonyms: string[] = [];
  $('.ant-list a, .antonyms-list a').each((_, el) => {
    const a = $(el).text().trim();
    if (a) antonyms.push(a);
  });

  // ---- examples scraped from definition text ----
  const examples: string[] = [];
  $('.ex-sent, .ure').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t) examples.push(t);
  });

  return {
    headword,
    functionalLabel,
    pronunciations,
    inflections,
    definitions,
    etymology,
    firstKnownUse,
    synonyms: synonyms.length > 0 ? synonyms : undefined,
    antonyms: antonyms.length > 0 ? antonyms : undefined,
    examples: examples.length > 0 ? examples : undefined,
  };
}
```

- [ ] **Step 2: Verify compiles**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/fetch/parser.ts
git commit -m "feat: add defensive cheerio parser for M-W HTML"
```

---

### Task 6: Spinner Component

**Files:**
- Create: `src/render/spinner.tsx`

- [ ] **Step 1: Write spinner.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import { Text } from 'ink';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface SpinnerProps {
  word: string;
}

export function Spinner({ word }: SpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text dimColor>
      {FRAMES[frame]} Looking up "{word}"...
    </Text>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/render/spinner.tsx
git commit -m "feat: add Ink spinner component"
```

---

### Task 7: LookupResult Component

**Files:**
- Create: `src/render/lookup-result.tsx`

This is the main display component. It receives `WordData` and a `DetailLevel`, and renders the styled box.

- [ ] **Step 1: Write lookup-result.tsx**

```typescript
import React from 'react';
import { Text, Box } from 'ink';
import type { WordData, DetailLevel } from '../types.js';

interface LookupResultProps {
  data: WordData;
  detail: DetailLevel;
  redirectFrom?: string;
  index?: number;
}

function sectionColor(section: string): string {
  switch (section) {
    case 'headword': return 'cyan';
    case 'pronunciation': return 'yellow';
    case 'divider': return 'magenta';
    case 'definitionNum': return 'green';
    case 'example': return 'grey';
    case 'label': return 'dim';
    default: return 'white';
  }
}

export function LookupResult({ data, detail, redirectFrom, index }: LookupResultProps) {
  const showExtended = detail !== 'minimal';
  const showThesaurus = detail === 'full';

  const header = index !== undefined
    ? `${String.fromSuperscript(index + 1)}${data.headword}`
    : data.headword;

  const title = [header, data.functionalLabel].filter(Boolean).join('  ');

  return (
    <Box flexDirection="column" marginY={1}>
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={2} paddingY={1}>
        {/* Title */}
        <Text bold color="cyan">
          {title}
        </Text>

        {redirectFrom && redirectFrom !== data.headword && (
          <Text dimColor>Showing results for: {data.headword}</Text>
        )}

        {/* Pronunciations */}
        {data.pronunciations.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {data.pronunciations.map((p, i) => (
              <Text key={i} color="yellow">
                {p.label ? `${p.label}: ` : 'Pronunciation: '}{p.text}
              </Text>
            ))}
          </Box>
        )}

        {/* Inflections */}
        {data.inflections.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {data.inflections.map((inf, i) => (
              <Text key={i} color="yellow">
                {inf.form}{inf.label ? ` (${inf.label})` : ''}
              </Text>
            ))}
          </Box>
        )}

        {/* Definitions */}
        {data.definitions.map((group, gi) => (
          <Box key={gi} flexDirection="column" marginTop={1}>
            {group.divider && (
              <Text italic color="magenta">{group.divider}</Text>
            )}
            {group.entries.map((entry, ei) => (
              <Box key={ei} flexDirection="column" marginTop={ei > 0 || group.divider ? 0 : 0}>
                <Text>
                  <Text color="green">{entry.number}. </Text>
                  <Text>{entry.text}</Text>
                </Text>
                {showExtended && entry.examples?.map((ex, exi) => (
                  <Text key={exi} color="grey" italic>
                    {'  '}► "{ex}"
                  </Text>
                ))}
              </Box>
            ))}
          </Box>
        ))}

        {/* Etymology */}
        {showExtended && data.etymology && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Etymology: </Text>
            <Text>{data.etymology}</Text>
          </Box>
        )}

        {/* First known use */}
        {showExtended && data.firstKnownUse && (
          <Text marginTop={1} dimColor>
            First known use: {data.firstKnownUse}
          </Text>
        )}

        {/* Synonyms */}
        {showThesaurus && data.synonyms && data.synonyms.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Synonyms:</Text>
            <Text>{data.synonyms.join(', ')}</Text>
          </Box>
        )}

        {/* Antonyms */}
        {showThesaurus && data.antonyms && data.antonyms.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Antonyms:</Text>
            <Text>{data.antonyms.join(', ')}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

/**
 * Minimal polyfill for superscript numbers: ¹²³⁴⁵⁶⁷⁸⁹
 */
function String_fromSuperscript(n: number): string {
  const SUPERS = ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  return String(n).split('').map((d) => SUPERS[+d - 1] || d).join('');
}
```

This won't compile yet — `String.fromSuperscript` is called as a method. Let's fix the approach right in the code: use a plain function, not a prototype extension.

Wait — I used `String.fromSuperscript(index + 1)` but defined `String_fromSuperscript`. Let me fix this: the `{header}` line should use the standalone function.

- [ ] **Step 2: Quick self-check** — the header line above has `String.fromSuperscript(index + 1)`, but the function is defined as `String_fromSuperscript`. Fix the call site in this step. Replace that line:

```typescript
  const header = index !== undefined
    ? `${fromSuperscript(index + 1)}${data.headword}`
    : data.headword;
```

And rename the function at the bottom of the file from `String_fromSuperscript` to `fromSuperscript`.

Let's rewrite the file cleanly to avoid confusion.

- [ ] **Step 1 (revised): Write lookup-result.tsx — corrected version**

```typescript
import React from 'react';
import { Text, Box } from 'ink';
import type { WordData, DetailLevel } from '../types.js';

interface LookupResultProps {
  data: WordData;
  detail: DetailLevel;
  redirectFrom?: string;
  index?: number;
}

function fromSuperscript(n: number): string {
  const SUPERS = ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  return String(n).split('').map((d) => SUPERS[+d - 1] || d).join('');
}

export function LookupResult({ data, detail, redirectFrom, index }: LookupResultProps) {
  const showExtended = detail !== 'minimal';
  const showThesaurus = detail === 'full';

  const header = index !== undefined
    ? `${fromSuperscript(index + 1)}${data.headword}`
    : data.headword;

  const title = [header, data.functionalLabel].filter(Boolean).join('  ');

  return (
    <Box flexDirection="column" marginY={1}>
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={2} paddingY={1}>
        {/* Title */}
        <Text bold color="cyan">
          {title}
        </Text>

        {redirectFrom && redirectFrom !== data.headword && (
          <Text dimColor>Showing results for: {data.headword}</Text>
        )}

        {/* Pronunciations */}
        {data.pronunciations.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {data.pronunciations.map((p, i) => (
              <Text key={i} color="yellow">
                {p.label ? `${p.label}: ` : 'Pronunciation: '}{p.text}
              </Text>
            ))}
          </Box>
        )}

        {/* Inflections */}
        {data.inflections.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {data.inflections.map((inf, i) => (
              <Text key={i} color="yellow">
                {inf.form}{inf.label ? ` (${inf.label})` : ''}
              </Text>
            ))}
          </Box>
        )}

        {/* Definitions */}
        {data.definitions.map((group, gi) => (
          <Box key={gi} flexDirection="column" marginTop={1}>
            {group.divider && (
              <Text italic color="magenta">{group.divider}</Text>
            )}
            {group.entries.map((entry, ei) => (
              <Box key={ei} flexDirection="column">
                <Text>
                  <Text color="green">{entry.number}. </Text>
                  <Text>{entry.text}</Text>
                </Text>
                {showExtended && entry.examples?.map((ex, exi) => (
                  <Text key={exi} color="grey" italic>
                    {'  '}► "{ex}"
                  </Text>
                ))}
              </Box>
            ))}
          </Box>
        ))}

        {/* Etymology */}
        {showExtended && data.etymology && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Etymology: </Text>
            <Text>{data.etymology}</Text>
          </Box>
        )}

        {/* First known use */}
        {showExtended && data.firstKnownUse && (
          <Text marginTop={1} dimColor>
            First known use: {data.firstKnownUse}
          </Text>
        )}

        {/* Synonyms */}
        {showThesaurus && data.synonyms && data.synonyms.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Synonyms:</Text>
            <Text>{data.synonyms.join(', ')}</Text>
          </Box>
        )}

        {/* Antonyms */}
        {showThesaurus && data.antonyms && data.antonyms.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Antonyms:</Text>
            <Text>{data.antonyms.join(', ')}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/render/lookup-result.tsx
git commit -m "feat: add LookupResult Ink component"
```

---

### Task 8: App Component (single-shot mode)

**Files:**
- Create: `src/render/app.tsx`

- [ ] **Step 1: Write app.tsx**

```typescript
import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import type { WordData, DetailLevel } from '../types.js';
import { LookupResult } from './lookup-result.js';
import { Spinner } from './spinner.js';
import { lookup } from '../fetch/lookup.js';

interface AppProps {
  word: string;
  detail: DetailLevel;
  refresh: boolean;
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'data'; results: WordData[]; redirectFrom?: string };

export function App({ word, detail, refresh }: AppProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const result = await lookup(word, { refresh });
        if (cancelled) return;
        if (result === null) {
          setState({ kind: 'error', message: `No results for "${word}".` });
        } else {
          setState({ kind: 'data', results: result.words, redirectFrom: result.redirectFrom });
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', message: msg });
      }
    }
    run();
    return () => { cancelled = true; };
  }, [word, refresh]);

  if (state.kind === 'loading') {
    return <Spinner word={word} />;
  }

  if (state.kind === 'error') {
    return <Text color="red">✖ {state.message}</Text>;
  }

  if (state.results.length === 0) {
    return <Text color="yellow">⚠ No results for "{word}".</Text>;
  }

  return (
    <>
      {state.results.map((data, i) => (
        <LookupResult
          key={i}
          data={data}
          detail={detail}
          redirectFrom={state.redirectFrom}
          index={state.results.length > 1 ? i : undefined}
        />
      ))}
    </>
  );
}
```

Note: `./fetch/lookup.js` does not exist yet — we need a coordinator module. Let's add it.

- [ ] **Step 2: Write the fetch coordinator — src/fetch/lookup.ts**

```typescript
import type { WordData } from '../types.js';
import { readCache, writeCache } from './cache.js';
import { fetchPage } from './browser.js';
import { parseHtml } from './parser.js';

export interface LookupResult {
  words: WordData[];
  redirectFrom?: string;
}

export async function lookup(
  word: string,
  opts: { refresh?: boolean } = {},
): Promise<LookupResult | null> {
  // 1. check cache
  if (!opts.refresh) {
    const cached = await readCache(word);
    if (cached) {
      return { words: [cached] };
    }
  }

  // 2. fetch live
  const { html, finalUrl } = await fetchPage(word);

  // 3. parse
  const parsed = parseHtml(html, finalUrl);
  if (!parsed) {
    return null;
  }

  // 4. write cache
  await writeCache(word, parsed);

  // 5. detect redirect (e.g., "incubat" → "incubate")
  const originalWord = word.toLowerCase();
  const finalWord = parsed.headword.toLowerCase();
  const redirectFrom =
    originalWord !== finalWord && !finalWord.includes(originalWord)
      ? word
      : undefined;

  return {
    words: [parsed],
    redirectFrom,
  };
}
```

- [ ] **Step 3: Verify compiles**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/render/app.tsx src/fetch/lookup.ts
git commit -m "feat: add App component + fetch coordinator"
```

---

### Task 9: REPL Component

**Files:**
- Create: `src/render/repl.tsx`

The REPL keeps the browser open across lookups for faster successive queries. It uses Ink's `useInput` for keyboard handling and manages its own state for the current word and result.

- [ ] **Step 1: Write repl.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import { Text, Box, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { WordData, DetailLevel } from '../types.js';
import { LookupResult } from './lookup-result.js';
import { lookup } from '../fetch/lookup.js';

interface ReplShellProps {
  detail: DetailLevel;
  refresh: boolean;
}

type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading'; word: string }
  | { kind: 'error'; word: string; message: string }
  | { kind: 'data'; word: string; results: WordData[]; redirectFrom?: string };

export function ReplShell({ detail, refresh }: ReplShellProps) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<LookupState>({ kind: 'idle' });

  const doLookup = useCallback(
    async (word: string) => {
      const trimmed = word.trim();
      if (!trimmed) return;
      setState({ kind: 'loading', word: trimmed });
      try {
        const result = await lookup(trimmed, { refresh });
        if (result === null) {
          setState({ kind: 'error', word: trimmed, message: `No results for "${trimmed}".` });
        } else {
          setState({
            kind: 'data',
            word: trimmed,
            results: result.words,
            redirectFrom: result.redirectFrom,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', word: trimmed, message: msg });
      }
    },
    [refresh],
  );

  const onSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim().toLowerCase();
      if (trimmed === 'q' || trimmed === 'quit' || trimmed === 'exit') {
        process.exit(0);
      }
      if (trimmed === '?') {
        // show help inline
        setState({ kind: 'idle' });
        return;
      }
      setInput('');
      doLookup(trimmed);
    },
    [doLookup],
  );

  useInput((input, key) => {
    if (key.escape) {
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column">
      {/* Help banner on first launch */}
      {state.kind === 'idle' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Word Lookup REPL</Text>
          <Text dimColor>Type a word and press Enter to look it up.</Text>
          <Text dimColor>Type ? for help  |  q to quit  |  Esc to exit</Text>
          <Text dimColor>Detail: {detail}  |  Cache: {refresh ? 'bypassed' : 'enabled'}</Text>
        </Box>
      )}

      {/* Previous result stays visible */}
      {state.kind === 'data' && (
        <>
          {state.results.map((data, i) => (
            <LookupResult
              key={i}
              data={data}
              detail={detail}
              redirectFrom={state.redirectFrom}
              index={state.results.length > 1 ? i : undefined}
            />
          ))}
        </>
      )}

      {state.kind === 'error' && (
        <Text color="red">✖ {state.message}</Text>
      )}

      {/* Input line */}
      <Box marginTop={1}>
        <Text color="green">{'> '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={onSubmit}
          placeholder="type a word..."
        />
        {state.kind === 'loading' && (
          <Text dimColor>  Searching...</Text>
        )}
      </Box>

      {/* Status bar */}
      <Box marginTop={1}>
        <Text dimColor>?help  |  q quit  |  Esc exit</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Verify compiles**

```bash
pnpm typecheck
```

Expected: exit 0, or type errors fixed.

- [ ] **Step 3: Commit**

```bash
git add src/render/repl.tsx
git commit -m "feat: add REPL interactive mode component"
```

---

### Task 10: CLI Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write index.ts**

```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { render } from 'ink';
import React from 'react';
import { App } from './render/app.js';
import { ReplShell } from './render/repl.js';
import { closeBrowser } from './fetch/browser.js';
import type { DetailLevel } from './types.js';

program
  .name('wordlookup')
  .description('Look up English word definitions from Merriam-Webster')
  .version('1.0.0')
  .argument('[word]', 'word to look up (omit with -i for interactive mode)')
  .option('-i, --interactive', 'start interactive REPL mode')
  .option('-m, --minimal', 'minimal output (definitions + pronunciation only)')
  .option('-f, --full', 'full output (includes synonyms and antonyms)')
  .option('-r, --refresh', 'force fresh fetch, bypass cache')
  .action(async (word: string | undefined, options: Record<string, boolean>) => {
    const detail: DetailLevel = options.full ? 'full' : options.minimal ? 'minimal' : 'standard';

    if (options.interactive || !word) {
      // REPL mode
      const { waitUntilExit } = render(
        React.createElement(ReplShell, { detail, refresh: options.refresh ?? false }),
      );
      await waitUntilExit();
    } else {
      // single-shot mode
      const { waitUntilExit } = render(
        React.createElement(App, { word, detail, refresh: options.refresh ?? false }),
      );
      await waitUntilExit();
    }

    await closeBrowser();
  });

program.parse();
```

- [ ] **Step 2: Verify compiles**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point with commander"
```

---

### Task 11: End-to-End Verification

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Dry-run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0, no type errors.

- [ ] **Step 2: Run single-shot lookup**

```bash
pnpm dev incubate
```

Expected: renders `<LookupResult>` box with "incubate" verb, pronunciations, numbered definitions, etymology, first known use. Spinner shows briefly, then the result.

Things to check manually:
- The box border renders with rounded corners (`borderStyle="round"`)
- Headword is bold cyan
- Pronunciation text is yellow
- Definition numbers are green
- Etymology and first known use appear (standard detail)
- No synonyms/antonyms sections (standard detail, not full)

- [ ] **Step 3: Test --minimal flag**

```bash
pnpm dev incubate --minimal
```

Expected: pronunciation + definitions only. No etymology, first known use, examples, synonyms, or antonyms.

- [ ] **Step 4: Test --full flag**

```bash
pnpm dev incubate --full
```

Expected: same as default + synonyms section, antonyms section (if available for the word).

- [ ] **Step 5: Test --refresh flag**

```bash
pnpm dev incubate --refresh
```

Expected: same output as default, but cache is bypassed and re-written.

- [ ] **Step 6: Test REPL mode**

```bash
pnpm dev -i
```

Expected:
- Help banner shows
- `>` prompt with placeholder "type a word..."
- Type `incubate` + Enter → result renders above the prompt
- Type another word → replaces the result
- Type `q` + Enter → exits
- Press Esc → exits

- [ ] **Step 7: Test cache replay (no network)**

Run the same word twice:

```bash
pnpm dev serendipity
# wait for result
pnpm dev serendipity
```

Expected: second run is instant (cache hit). The output is the same.

- [ ] **Step 8: Test edge case — nonsense word**

```bash
pnpm dev asdfghjkl
```

Expected: "⚠ No results for "asdfghjkl"." message.

- [ ] **Step 9: Test edge case — pipe to file (no TTY)**

```bash
pnpm dev incubate > /tmp/word-output.txt 2>&1
cat /tmp/word-output.txt
```

Expected: output exists and is readable raw text (Ink degrades gracefully).

- [ ] **Step 10: Final commit (if any fixes were made)**

```bash
git add -A
git commit -m "chore: finalize v1 word lookup app"
```
