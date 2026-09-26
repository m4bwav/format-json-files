// One file's bytes to its formatted bytes, or the reason it is left alone (plan D3). No filesystem access here.
import {findLoss} from './scan.js';
import {stringifySorted, type Json} from './serialize.js';

export type Eol = 'lf' | 'crlf' | 'auto';

export type FormatSettings = {
  indent: string;
  sortKeys: boolean;
  finalNewline: boolean;
  eol: Eol;
};

export type FormatOutcome = {output: Uint8Array} | {reason: string};

const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});
const encoder = new TextEncoder();

export function formatBytes(bytes: Uint8Array, settings: FormatSettings): FormatOutcome {
  let text: string;
  try {
    text = decoder.decode(bytes);
  } catch {
    // 1.0.6 read invalid bytes as U+FFFD and wrote the replacement character back (E1).
    return {reason: 'not UTF-8'};
  }

  // 1.0.6 could not parse a file that starts with a byte order mark; 2.x drops it and formats the file (E2).
  if (text.startsWith('﻿')) {
    text = text.slice(1);
  }

  let value: Json;
  try {
    value = JSON.parse(text) as Json;
  } catch (error) {
    return {reason: `not valid JSON: ${(error as Error).message}`};
  }

  const loss = findLoss(text);
  if (loss) {
    return {reason: loss.kind === 'number' ? `number cannot be kept exactly: ${loss.token}` : `duplicate key: ${JSON.stringify(loss.key)}`};
  }

  let output: string;
  try {
    output = settings.sortKeys ? stringifySorted(value, settings.indent) : JSON.stringify(value, null, settings.indent);
  } catch (error) {
    if (error instanceof RangeError) {
      return {reason: 'nested too deeply'};
    }

    throw error;
  }

  // JSON text holds no raw line breaks inside strings, so every \n here is a line break the formatter wrote.
  const eol = settings.eol === 'crlf' || (settings.eol === 'auto' && text.includes('\r\n')) ? '\r\n' : '\n';
  if (eol === '\r\n') {
    output = output.replaceAll('\n', '\r\n');
  }

  if (settings.finalNewline) {
    output += eol;
  }

  return {output: encoder.encode(output)};
}
