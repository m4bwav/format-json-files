// The lossless check (plan D3, E1). JSON.parse turns every number into a double and keeps the last of duplicate keys, so a
// rewrite from the parsed value can change what the file says. This scanner walks text that JSON.parse has already accepted
// and returns the first thing a rewrite would change, or undefined when the rewrite keeps every value.
//
// Numbers: one written as a plain integer must be exactly the double it parses to (ids and counts above 2^53 are not); -0
// would be written as 0; a number beyond the double range would be written as null; a non-zero number that parses to 0
// would lose its value. Numbers written with a fraction or an exponent are floating point: rounded to the nearest double as
// JSON.parse always has, and accepted (6.02e23 is not refused because it is not an exact double).
// The walk is iterative, so nesting depth cannot overflow the stack.

const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?/iuy;
export type LossReason = {kind: 'number'; token: string} | {kind: 'duplicate-key'; key: string};

// The index just past the closing quote of the string that starts at `start`. A loop, not a regular expression: V8's
// backtracking stack overflows on a regex over a string of about ten million characters (Phase 3 review).
function stringEnd(text: string, start: number): number {
  let index = start + 1;
  for (;;) {
    const quote = text.indexOf('"', index);
    let backslashes = 0;
    while (text[quote - 1 - backslashes] === '\\') {
      backslashes++;
    }

    if (backslashes % 2 === 0) {
      return quote + 1;
    }

    index = quote + 1;
  }
}

export function isKeptExactly(token: string): boolean {
  const value = Number(token);
  if (!Number.isFinite(value) || Object.is(value, -0)) {
    return false;
  }

  // Written as an integer (an id, a count): the rewrite must write the same digits. JSON.stringify writes a double above
  // 2^53 as its shortest decimal form, so 12345678901234567168 (an exact double) becomes 12345678901234567000, and 1e21
  // and up turn into exponent form.
  // Written with a fraction or an exponent: a floating-point number, rounded to the nearest double as JSON.parse always has.
  // Only a non-zero number that underflowed to 0 has lost its value.
  return /^-?\d+$/u.test(token)
    ? String(value) === String(BigInt(token))
    : value !== 0 || !/[1-9]/u.test(token.split(/e/iu, 1)[0]!);
}

/**
Returns the first value a rewrite of `text` would change, or undefined. `text` must be JSON that JSON.parse accepts.
*/
export function findLoss(text: string): LossReason | undefined {
  // One Set of seen keys per open object; undefined for an open array.
  const stack: Array<Set<string> | undefined> = [];
  let isExpectKey = false;
  let index = 0;
  while (index < text.length) {
    const character = text[index]!;
    switch (character) {
      case '{': {
        stack.push(new Set());
        isExpectKey = true;
        index++;
        break;
      }

      case '[': {
        stack.push(undefined);
        isExpectKey = false;
        index++;
        break;
      }

      case '}':
      case ']': {
        stack.pop();
        isExpectKey = false;
        index++;
        break;
      }

      case ',': {
        isExpectKey = stack.at(-1) !== undefined;
        index++;
        break;
      }

      case '"': {
        const end = stringEnd(text, index);
        const token = text.slice(index, end);
        index = end;
        if (isExpectKey) {
          const key = JSON.parse(token) as string;
          const seen = stack.at(-1)!;
          if (seen.has(key)) {
            return {kind: 'duplicate-key', key};
          }

          seen.add(key);
          isExpectKey = false;
        }

        break;
      }

      default: {
        if (character === '-' || (character >= '0' && character <= '9')) {
          numberPattern.lastIndex = index;
          const token = numberPattern.exec(text)![0];
          index += token.length;
          if (!isKeptExactly(token)) {
            return {kind: 'number', token};
          }
        } else {
          // Whitespace, a colon, or a letter of true, false or null.
          index++;
        }
      }
    }
  }

  return undefined;
}
