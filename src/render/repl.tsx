import React, { useState, useCallback } from 'react';
import { Text, Box, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { WordData, DetailLevel } from '../types.js';
import { LookupResult } from './lookup-result.js';
import { Spinner } from './spinner.js';
import { lookup } from '../fetch/lookup.js';

interface ReplShellProps {
  detail: DetailLevel;
  refresh: boolean;
}

type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading'; word: string; prev: { results: WordData[]; redirectFrom?: string } | null }
  | { kind: 'error'; word: string; message: string; prev: { results: WordData[]; redirectFrom?: string } | null }
  | { kind: 'data'; word: string; results: WordData[]; redirectFrom?: string };

export function ReplShell({ detail, refresh }: ReplShellProps) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<LookupState>({ kind: 'idle' });

  const doLookup = useCallback(
    async (word: string) => {
      const trimmed = word.trim();
      if (!trimmed) return;

      // snapshot previous result before transitioning to loading
      const prev =
        state.kind === 'data'
          ? { results: state.results, redirectFrom: state.redirectFrom }
          : null;

      setState({ kind: 'loading', word: trimmed, prev });
      try {
        const result = await lookup(trimmed, { refresh });
        if (result === null) {
          setState({
            kind: 'error',
            word: trimmed,
            message: `No results for "${trimmed}".`,
            prev,
          });
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
        setState({ kind: 'error', word: trimmed, message: msg, prev });
      }
    },
    [refresh, state],
  );

  const onSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim().toLowerCase();
      if (trimmed === 'q' || trimmed === 'quit' || trimmed === 'exit') {
        process.exit(0);
      }
      if (trimmed === '?') {
        setState({ kind: 'idle' });
        return;
      }
      setInput('');
      doLookup(trimmed);
    },
    [doLookup],
  );

  useInput((_input, key) => {
    if (key.escape) {
      process.exit(0);
    }
  });

  // Extract previous result for rendering during loading/error states
  const prevResults = state.kind === 'loading' || state.kind === 'error' ? state.prev : null;

  return (
    <Box flexDirection="column">
      {/* Help banner on first launch or ? */}
      {state.kind === 'idle' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>delve — REPL</Text>
          <Text dimColor>Type a word and press Enter to look it up.</Text>
          <Text dimColor>
            Type ? for help | q to quit | Esc to exit
          </Text>
          <Text dimColor>
            Detail: {detail} | Cache: {refresh ? 'bypassed' : 'enabled'}
          </Text>
        </Box>
      )}

      {/* Show previous result while loading or after error */}
      {prevResults && (
        <>
          {prevResults.results.map((data, i) => (
            <LookupResult
              key={i}
              data={data}
              detail={detail}
              redirectFrom={prevResults.redirectFrom}
              index={prevResults.results.length > 1 ? i : undefined}
            />
          ))}
        </>
      )}

      {/* Current result */}
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

      {/* Error message — previous result already rendered above */}
      {state.kind === 'error' && (
        <Text color="red">✖ {state.message}</Text>
      )}

      {/* Spinner during loading */}
      {state.kind === 'loading' && (
        <Box marginY={1}>
          <Spinner word={state.word} />
        </Box>
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
      </Box>

      {/* Status bar */}
      <Box marginTop={1}>
        <Text dimColor>?help | q quit | Esc exit</Text>
      </Box>
    </Box>
  );
}
