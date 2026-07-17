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
  return String(n)
    .split('')
    .map((d) => SUPERS[+d - 1] || d)
    .join('');
}

export function LookupResult({ data, detail, redirectFrom, index }: LookupResultProps) {
  const showExtended = detail !== 'minimal';
  const showThesaurus = detail === 'full';

  const header =
    index !== undefined
      ? `${fromSuperscript(index + 1)}${data.headword}`
      : data.headword;

  const title = [header, data.functionalLabel].filter(Boolean).join('  ');

  return (
    <Box flexDirection="column" marginY={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        flexDirection="column"
        paddingX={2}
        paddingY={1}
      >
        {/* Title */}
        <Text bold color="cyan">
          {title}
        </Text>

        {redirectFrom && redirectFrom !== data.headword && (
          <Text dimColor>Showing results for: {data.headword}</Text>
        )}

        {/* Definitions */}
        {data.definitions.map((group, gi) => (
          <Box key={gi} flexDirection="column" marginTop={1}>
            {group.divider && (
              <Text italic color="magenta">
                {group.divider}
              </Text>
            )}
            {group.entries.map((entry, ei) => (
              <Box key={ei} flexDirection="column">
                <Text>
                  <Text color="green">{entry.number}. </Text>
                  <Text>{entry.text}</Text>
                </Text>
                {showExtended &&
                  entry.examples?.map((ex, exi) => (
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
          <Box marginTop={1}>
            <Text dimColor>
              First known use: {data.firstKnownUse}
            </Text>
          </Box>
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

        {/* Pronunciations */}
        {data.pronunciations.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {data.pronunciations.map((p, i) => (
              <Text key={i} color="yellow">
                {p.label ? `${p.label}: ` : 'Pronunciation: '}
                {p.text}
              </Text>
            ))}
          </Box>
        )}

        {/* Inflections */}
        {data.inflections.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            {data.inflections.map((inf, i) => (
              <Text key={i} color="yellow">
                {inf.form}
                {inf.label ? ` (${inf.label})` : ''}
              </Text>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
