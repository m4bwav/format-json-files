// The walk (plan D1, D3, D6, D7). The argument checks, the file and directory tests (lstat) and the file-name rule are
// 1.0.6's, in 1.0.6's order, so the golden capture's throws and file choices hold.
import {
  lstatSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {formatBytes, type Eol, type FormatSettings} from './format.js';

type Options = {
  /**
  Spaces per level (0 to 10), or '\t' for tabs. Default 4, as 1.0.6.
  */
  indent?: number | '\t';
  /**
  Sort object keys by UTF-16 code unit, at every level; arrays keep their order. Default false.
  */
  sortKeys?: boolean;
  /**
  Write nothing; `changed` lists the files that would be rewritten. Default false.
  */
  check?: boolean;
  /**
  End each file with a line break. Default false, as 1.0.6.
  */
  finalNewline?: boolean;
  /**
  Line breaks to write: 'lf' (default, as 1.0.6), 'crlf', or 'auto' to keep each file's (CRLF if the file has any).
  */
  eol?: Eol;
  /**
  Directory names the walk does not enter. Default ['node_modules', '.git']; [] walks everything, as 1.0.6.
  */
  ignore?: readonly string[];
};

type Skipped = {
  path: string;
  reason: string;
};

type Report = {
  /**
  Files rewritten, or in check mode the files that would be.
  */
  changed: string[];
  /**
  Files already formatted; left alone.
  */
  unchanged: string[];
  /**
  Files left alone because they could not be formatted without changing a value, parsed, read or written.
  */
  skipped: Skipped[];
};

// Declared under short names and exported under the public ones, so the CommonJS declaration's namespace can alias them
// without the declaration bundler writing `type FormatOptions = FormatOptions`.
export type {Options as FormatOptions, Report as FormatReport, Skipped as SkippedFile};

type Settings = FormatSettings & {check: boolean; ignore: ReadonlySet<string>};

const defaultIgnore = ['node_modules', '.git'];

function readIndent(indent: unknown): string {
  if (indent === '\t') {
    return '\t';
  }

  if (!Number.isSafeInteger(indent) || (indent as number) < 0 || (indent as number) > 10) {
    throw new TypeError(String.raw`The indent option must be an integer from 0 to 10, or '\t'`);
  }

  return ' '.repeat(indent as number);
}

function readSettings(options: Options | undefined): Settings {
  options ??= {};

  if (typeof options !== 'object') {
    throw new TypeError('Options must be an object');
  }

  const {indent = 4, sortKeys = false, check = false, finalNewline = false, eol = 'lf', ignore = defaultIgnore} = options;
  for (const [name, value] of Object.entries({sortKeys, check, finalNewline})) {
    if (typeof value !== 'boolean') {
      throw new TypeError(`The ${name} option must be a boolean`);
    }
  }

  if (eol !== 'lf' && eol !== 'crlf' && eol !== 'auto') {
    throw new TypeError('The eol option must be \'lf\', \'crlf\' or \'auto\'');
  }

  if (!Array.isArray(ignore) || ignore.some(name => typeof name !== 'string')) {
    throw new TypeError('The ignore option must be an array of directory names');
  }

  return {
    indent: readIndent(indent),
    sortKeys,
    check,
    finalNewline,
    eol,
    ignore: new Set(ignore),
  };
}

function isJsonFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.json');
}

function describeError(error: unknown): string {
  const {code} = error as {code?: unknown};
  return typeof code === 'string' ? code : String(error);
}

function formatFile(filePath: string, settings: Settings, report: Report): void {
  let bytes: Uint8Array;
  try {
    bytes = readFileSync(filePath);
  } catch (error) {
    report.skipped.push({path: filePath, reason: `cannot read: ${describeError(error)}`});
    return;
  }

  const outcome = formatBytes(bytes, settings);
  if ('reason' in outcome) {
    report.skipped.push({path: filePath, reason: outcome.reason});
    return;
  }

  if (Buffer.from(outcome.output).equals(bytes)) {
    report.unchanged.push(filePath);
    return;
  }

  if (!settings.check) {
    try {
      writeFileSync(filePath, outcome.output);
    } catch (error) {
      report.skipped.push({path: filePath, reason: `cannot write: ${describeError(error)}`});
      return;
    }
  }

  report.changed.push(filePath);
}

function formatDirectory(directoryPath: string, settings: Settings, report: Report): void {
  let entries: string[];
  try {
    entries = readdirSync(directoryPath);
  } catch (error) {
    report.skipped.push({path: directoryPath, reason: `cannot read: ${describeError(error)}`});
    return;
  }

  for (const entry of entries) {
    const filename = path.join(directoryPath, entry);
    const stat = lstatSync(filename);
    if (stat.isDirectory()) {
      if (!settings.ignore.has(entry)) {
        formatDirectory(filename, settings, report);
      }
    } else if (isJsonFileName(filename)) {
      if (stat.isSymbolicLink()) {
        // 1.0.6 wrote through links, to wherever they pointed (E6). A link to a directory was never entered.
        report.skipped.push({path: filename, reason: 'symbolic link'});
      } else {
        formatFile(filename, settings, report);
      }
    }
  }
}

function isExisting(targetPath: string, kind: 'isFile' | 'isDirectory'): boolean {
  try {
    return lstatSync(targetPath)[kind]();
  } catch {
    return false;
  }
}

/**
Formats the file at `targetPath` whatever its name, or every file whose name ends in `.json` (any case) in the directory
at `targetPath` and its subdirectories, in place. Files that cannot be rewritten without changing a value are left alone
and reported; a file already formatted is not written.

Throws an Error when `targetPath` is empty or missing, a TypeError when it is not a string or an option is invalid, and an
Error('Invalid path') when it is neither a file nor a directory. Problems with single files never throw: they are in the
report's `skipped` list.
*/
export function formatJsonFiles(targetPath: string, options?: Options): Report {
  // 1.0.6 tested truthiness: an empty string, 0, NaN, false, null and undefined all get this error (golden cases arg-*).
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!targetPath) {
    throw new Error('Path argument not set');
  }

  if (typeof targetPath !== 'string') {
    throw new TypeError('Target path argument is not a string');
  }

  const settings = readSettings(options);
  const report: Report = {changed: [], unchanged: [], skipped: []};
  if (isExisting(targetPath, 'isFile')) {
    formatFile(targetPath, settings, report);
  } else if (isExisting(targetPath, 'isDirectory')) {
    formatDirectory(targetPath, settings, report);
  } else {
    throw new Error('Invalid path');
  }

  return report;
}
