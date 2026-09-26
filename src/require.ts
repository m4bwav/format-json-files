// The CommonJS entry. 1.0.6 did `module.exports = function (pathArgument)`, so require() still returns a function. It also
// carries `.default` and `.formatJsonFiles`, the two shapes transpiled callers and named-import habits reach for, and its
// namespace holds the types, so `export =` in the declaration file still exports FormatOptions, FormatReport and SkippedFile.
// A default export is this entry's only export, so the build writes it as `module.exports =` (tsdown's cjsDefault).
import {
  formatJsonFiles as format,
  type FormatOptions as Options,
  type FormatReport as Report,
  type SkippedFile as Skipped,
} from './format-json-files.js';

/**
Formats the file at `targetPath` whatever its name, or every file whose name ends in `.json` (any case) in the directory
at `targetPath` and its subdirectories, in place. Files that cannot be rewritten without changing a value are left alone
and reported; a file already formatted is not written.

Throws an Error when `targetPath` is empty or missing, a TypeError when it is not a string or an option is invalid, and an
Error('Invalid path') when it is neither a file nor a directory. Problems with single files never throw: they are in the
report's `skipped` list.
*/
function formatJsonFiles(targetPath: string, options?: Options): Report {
  return format(targetPath, options);
}

// The DefinitelyTyped form for a callable CommonJS export: the namespace re-exports the function under its two extra names.
// Assigning the properties directly would make TypeScript declare `var formatJsonFiles: typeof formatJsonFiles` inside the
// namespace, which refers to itself (TS2502) for every CommonJS consumer.
declare namespace formatJsonFiles {
  export {formatJsonFiles as default, formatJsonFiles};
  export type FormatOptions = Options;
  export type FormatReport = Report;
  export type SkippedFile = Skipped;
}

Object.assign(formatJsonFiles, {default: formatJsonFiles, formatJsonFiles});

export default formatJsonFiles;
