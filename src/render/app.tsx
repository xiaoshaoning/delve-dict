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
          setState({
            kind: 'data',
            results: result.words,
            redirectFrom: result.redirectFrom,
          });
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', message: msg });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [word, refresh]);

  // auto-exit after rendering result in single-shot mode
  useEffect(() => {
    if (state.kind === 'data' || state.kind === 'error') {
      // let Ink flush the output before exiting
      const timer = setTimeout(() => process.exit(state.kind === 'error' ? 1 : 0), 0);
      return () => clearTimeout(timer);
    }
  }, [state.kind]);

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
