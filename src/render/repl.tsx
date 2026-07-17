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
          setState({
            kind: 'error',
            word: trimmed,
            message: `No results for "${trimmed}".`,
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

  return (
    <Box flexDirection="column">
      {/* Help banner on first launch or ? */}
      {state.kind === 'idle' && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>Word Lookup REPL</Text>
          <Text dimColor>Type a word and press Enter to look it up.</Text>
          <Text dimColor>
            Type ? for help | q to quit | Esc to exit
          </Text>
          <Text dimColor>
            Detail: {detail} | Cache: {refresh ? 'bypassed' : 'enabled'}
          </Text>
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
        {state.kind === 'loading' && <Text dimColor>  Searching...</Text>}
      </Box>

      {/* Status bar */}
      <Box marginTop={1}>
        <Text dimColor>?help | q quit | Esc exit</Text>
      </Box>
    </Box>
  );
}
