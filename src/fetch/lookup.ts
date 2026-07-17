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
