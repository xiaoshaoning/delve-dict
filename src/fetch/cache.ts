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
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
  } catch {
    // cache write failure is non-fatal — silently skip
  }
}
