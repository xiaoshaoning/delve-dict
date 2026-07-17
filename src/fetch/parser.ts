import * as cheerio from 'cheerio';
import type { WordData, Pronunciation, DefinitionEntry } from '../types.js';

/**
 * Parse Merriam-Webster dictionary HTML into a WordData object.
 * Every extraction is defensive — M-W may change their markup at any time.
 *
 * M-W's current structure (2026):
 *   .entry-header > .hword + .parts-of-speech
 *   .entry-attr > .play-pron-v2 (IPA), .prons-entry-list-item (variants)
 *   .vg-sseq-entry-item > .sb-0/sb-1 (sense blocks) > .dtText (definitions)
 *   .vg-ins (inflections), .et (etymology), .first-use (first known use)
 */
export function parseHtml(html: string, _finalUrl: string): WordData | null {
  const $ = cheerio.load(html);

  // ---- headword ----
  const headword =
    $('.hword').first().text().trim() ||
    $('meta[name="title"]').attr('content')?.trim() ||
    'unknown';

  // Bail if no definition content found
  if (!$('.dtText').length && headword === 'unknown') {
    return null;
  }

  // ---- part of speech ----
  // M-W uses .parts-of-speech or .important-blue-link inside .entry-header
  const functionalLabel =
    $('.parts-of-speech').first().text().trim() ||
    $('.entry-header .important-blue-link').first().text().trim() ||
    '';

  // ---- pronunciations ----
  const pronunciations: Pronunciation[] = [];
  const seenProns = new Set<string>();

  // .play-pron-v2 contains the full IPA with an SVG audio icon
  $('.play-pron-v2').each((_, el) => {
    const clone = $(el).clone();
    clone.find('svg, title').remove();
    const text = clone.text().replace(/\s+/g, ' ').trim();
    // filter out noise: "How to pronounce", "audio", empty, too long
    if (
      text &&
      text.length >= 2 &&
      text.length < 80 &&
      !/how to pronounce|audio/i.test(text) &&
      !seenProns.has(text)
    ) {
      seenProns.add(text);
      pronunciations.push({ text });
    }
  });

  // .prons-entry-list-item for pronunciation variants
  $('.prons-entry-list-item').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (
      text &&
      text.length >= 2 &&
      text.length < 80 &&
      !/how to pronounce|audio/i.test(text) &&
      !seenProns.has(text)
    ) {
      seenProns.add(text);
      pronunciations.push({ text });
    }
  });

  // fallback: broader selectors
  if (pronunciations.length === 0) {
    $('.pr .play-pron, [class*="pron"]').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (
        text &&
        text.length >= 2 &&
        text.length < 80 &&
        !/how to pronounce|audio/i.test(text) &&
        !seenProns.has(text)
      ) {
        seenProns.add(text);
        pronunciations.push({ text });
      }
    });
  }

  // ---- inflections ----
  // .vg-ins contains combined forms like "incubated; incubating"
  const inflections: { form: string; label: string }[] = [];
  $('.vg-ins').first().each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      inflections.push({ form: text, label: '' });
    }
  });

  // ---- definitions ----
  // Collect .dtText directly — .dt is a wrapper that would cause duplicates.
  // Exclude Kids/Medical dictionary sections to avoid duplicate entries.
  const definitions: {
    divider?: string;
    entries: DefinitionEntry[];
  }[] = [];

  const dtTexts = $('.dtText').not('#kidsdictionary .dtText, #medicalDictionary .dtText');
  const entries: DefinitionEntry[] = [];
  const seenTexts = new Set<string>();

  dtTexts.each((i, el) => {
    const raw = $(el).text().replace(/\s+/g, ' ').trim();
    // Strip leading ": " that M-W uses as a separator
    let cleaned = raw.replace(/^:\s*/, '');

    if (!cleaned) return;

    // deduplicate by definition text
    if (seenTexts.has(cleaned)) return;
    seenTexts.add(cleaned);

    // Try to extract the definition number prefix (e.g. "1 :", "2a :", "3b(1) :")
    const numberMatch = cleaned.match(/^(\d+[a-z]?(?:\(\d+\))?)\s*:?\s+(.+)$/);
    const entry: DefinitionEntry = numberMatch
      ? { number: numberMatch[1], text: numberMatch[2] }
      : { number: `${i + 1}`, text: cleaned };

    // Look for usage examples inside this definition entry
    const examples: string[] = [];
    $(el).find('.ex-sent, .ure').each((_, ex) => {
      const exText = $(ex).text().replace(/\s+/g, ' ').trim();
      if (exText) examples.push(exText);
    });
    if (examples.length > 0) entry.examples = examples;

    entries.push(entry);
  });

  if (entries.length > 0) {
    definitions.push({ entries });
  }

  // ---- etymology ----
  const etymology =
    $('.et').first().text().replace(/\s+/g, ' ').trim() ||
    $('.word-origin').first().text().replace(/\s+/g, ' ').trim() ||
    undefined;

  // ---- first known use ----
  const firstKnownUse =
    $('.first-use-date').first().text().trim() ||
    $('.first-use').first().text().trim() ||
    undefined;

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
  };
}
