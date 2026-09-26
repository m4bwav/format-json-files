// The lossless check (plan D3, E1). JSON.parse turns every number into a double and keeps the last of duplicate keys, so a
// rewrite from the parsed value can change what the file says. This scanner walks text that JSON.parse has already accepted
// and returns the first thing a rewrite would change, or undefined when the rewrite keeps every value.
//
// Numbers: an integer (after moving trailing zeros into the exponent) must be exactly the double it parses to; -0 would be
// written as 0; a number beyond the double range would be written as null; a non-zero number that parses to 0 would lose its
// value. Fractions are rounded to the nearest double as JSON.parse always has, and are accepted.
// The walk is iterative, so nesting depth cannot overflow the stack.

const numberPattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const stringPattern = /"(?:[^"\\]|\\.)*"/y;
const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);

export type LossReason = {kind: 'number'; token: string} | {kind: 'duplicate-key'; key: string};

export function checkNumber(token: string): boolean {
  const value = Number(token);
  if (!Number.isFinite(value) || Object.is(value, -0)) {
    return false;
  }

  const match = /^-?(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u.exec(token);
  if (!match) {
    return false;
  }

  const [, whole = '', fraction = '', exponentText = '0'] = match;
  let digits = (whole + fraction).replace(/^0+/u, '');
  if (digits === '') {
    // Every digit is zero: the value is 0, and -0 was handled above.
    return true;
  }

  if (value === 0) {
    // A non-zero number that underflowed.
    return false;
  }

  let exponent = Number(exponentText) - fraction.length;
  const trailing = /0+$/u.exec(digits);
  if (trailing) {
    exponent += trailing[0].length;
    digits = digits.slice(0, -trailing[0].length);
  }

  if (exponent < 0) {
    // A fraction: rounded to the nearest double, as JSON.parse always has.
    return true;
  }

  // An integer. Doubles hold every integer up to 2^53 exactly; above that, compare exactly.
  const exact = BigInt(digits) * (10n ** BigInt(exponent));
  if (exact <= maxSafe) {
    return true;
  }

  return exact === BigInt(Math.abs(value));
}

/**
Returns the first value a rewrite of `text` would change, or undefined. `text` must be JSON that JSON.parse accepts.
*/
export function findLoss(text: string): LossReason | undefined {
  // One Set of seen keys per open object; undefined for an open array.
  const stack: Array<Set<string> | undefined> = [];
  let expectKey = false;
  let index = 0;
  while (index < text.length) {
    const character = text[index]!;
    switch (character) {
      case '{': {
        stack.push(new Set());
        expectKey = true;
        index++;
        break;
      }

      case '[': {
        stack.push(undefined);
        expectKey = false;
        index++;
        break;
      }

      case '}':
      case ']': {
        stack.pop();
        expectKey = false;
        index++;
        break;
      }

      case ',': {
        expectKey = stack.at(-1) !== undefined;
        index++;
        break;
      }

      case '"': {
        stringPattern.lastIndex = index;
        const token = stringPattern.exec(text)![0];
        index += token.length;
        if (expectKey) {
          const key = JSON.parse(token) as string;
          const seen = stack.at(-1)!;
          if (seen.has(key)) {
            return {kind: 'duplicate-key', key};
          }

          seen.add(key);
          expectKey = false;
        }

        break;
      }

      default: {
        if (character === '-' || (character >= '0' && character <= '9')) {
          numberPattern.lastIndex = index;
          const token = numberPattern.exec(text)![0];
          index += token.length;
          if (!checkNumber(token)) {
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
