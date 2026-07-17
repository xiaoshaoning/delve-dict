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
