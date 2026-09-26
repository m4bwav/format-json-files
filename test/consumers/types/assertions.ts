/*
Compile-time checks on the published declaration files. The runner copies this file into each TypeScript fixture as index.ts, so
it is checked under that fixture's module and resolution settings (ESM and CommonJS under nodenext, bundler, node10).
*/
import formatJsonFiles, {
  formatJsonFiles as named,
  type FormatOptions,
  type FormatReport,
  type SkippedFile,
} from 'format-json-files';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

// Compiles only when the argument is assignable to T.
declare function expectType<T>(value: T): void;

const options: FormatOptions = {
  indent: '\t',
  sortKeys: true,
  check: false,
  finalNewline: true,
  eol: 'auto',
  ignore: ['node_modules'],
};

declare const path: string;
const report = formatJsonFiles(path, options);
expectType<FormatReport>(report);
expectType<string[]>(report.changed);
expectType<string[]>(report.unchanged);
const skipped: SkippedFile[] = report.skipped;
expectType<string>(skipped[0]!.reason);
expectType<typeof formatJsonFiles>(named);

export type Checks = [
  Expect<Equal<ReturnType<typeof formatJsonFiles>, FormatReport>>,
];

// @ts-expect-error -- indent is a number or a tab
void formatJsonFiles(path, {indent: '  '});

// @ts-expect-error -- eol is lf, crlf or auto
void formatJsonFiles(path, {eol: 'cr'});

// @ts-expect-error -- the path is required
void formatJsonFiles();
