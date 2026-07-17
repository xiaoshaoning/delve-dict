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
    const detail: DetailLevel = options.full
      ? 'full'
      : options.minimal
        ? 'minimal'
        : 'standard';

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
