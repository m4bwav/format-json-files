// JSON.stringify(value, null, indent) with object keys in sorted order (plan D6, issue #1). A replacer cannot do this:
// JavaScript enumerates integer-like keys first whatever order an object is built in, so the keys are sorted here while
// writing. Everything else matches JSON.stringify's output for parsed JSON (the unit tests compare the two on unsorted input).
// Keys sort by UTF-16 code unit (Array.prototype.sort's default); arrays keep their order.

type Json = null | boolean | number | string | Json[] | {[key: string]: Json};

export function stringifySorted(value: Json, indent: string): string {
  return write(value, indent, '');
}

function write(value: Json, indent: string, current: string): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  const inner = current + indent;
  const open = indent === '' ? '' : `\n${inner}`;
  const close = indent === '' ? '' : `\n${current}`;
  const separator = indent === '' ? ',' : `,\n${inner}`;
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    return `[${open}${value.map(item => write(item, indent, inner)).join(separator)}${close}]`;
  }

  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : (a > b ? 1 : 0)));
  if (entries.length === 0) {
    return '{}';
  }

  const colon = indent === '' ? ':' : ': ';
  return `{${open}${entries.map(([key, item]) => JSON.stringify(key) + colon + write(item, indent, inner)).join(separator)}${close}}`;
}

export type {Json};
