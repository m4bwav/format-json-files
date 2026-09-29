// wiki-verify for format-json-files@2.0.0: runs every example on the wiki against the PUBLISHED package, never the
// working tree, on a fresh scratch copy of a fixture tree per case (file-tree.mjs beside this file, wikiwright's kit).
// Kept in the repository as ai-docs/notes/2026-09-29-wiki-verify.mjs, with file-tree.mjs as 2026-09-29-file-tree.mjs.
//
// Run it from a scratch folder outside the repository:
//   npm init -y
//   npm install format-json-files@2.0.0 typescript@6
//   node wiki-verify.mjs > wiki-verify.out.txt
// Environment:
//   GOLDEN=<clone>/test/golden OLD=<a folder with format-json-files@1.0.6 installed>  golden replay and 1.0.6 cases
//   RT=<a folder where `npm install deno bun` ran>                                    Deno and Bun cases (Windows)
//   BASH=<Git Bash's bash.exe>                                                          shell cases on Windows
//   OLDEST_NODE=20                                              reruns everything on Node 20 (npx fetches it), and
//   OLDEST_NODE_BIN=<a node binary>                             uses that binary instead of npx (Linux without npm)
// The Linux run (WSL) uses the same folder: see linux-run.sh beside this file.
//
// Every case prints "## <label>" and then its output. File cases print the case's own output, then one line per file
// (not written, written with the same bytes, changed, created, deleted), then each written file before and after, under
// a header naming its size, BOM, line endings and final newline. The tree's absolute path prints as <tree>.
// Nothing here makes a network request except package installs from the registries (npx, pnpm dlx, yarn dlx, bunx and
// Deno's npm: specifier fetch format-json-files@2.0.0 from registry.npmjs.org).

import {spawn} from 'node:child_process';
import {
	chmodSync,
	copyFileSync,
	existsSync,
	linkSync,
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import util from 'node:util';
import {fileURLToPath} from 'node:url';
import {treeCase} from './file-tree.mjs';

process.chdir(path.dirname(fileURLToPath(import.meta.url)));
const HERE = process.cwd();
const PACKAGE = 'format-json-files';
const VERSION = '2.0.0';
const WINDOWS = process.platform === 'win32';
const require = createRequire(import.meta.url);
const BOM = String.fromCharCode(0xFEFF);

function show(label, value) {
	console.log(`## ${label}`);
	console.log(typeof value === 'string' ? value : inspect(value));
	console.log();
}

function inspect(value) {
	return JSON.stringify(value, (key, v) => {
		if (v === undefined) {
			return '<undefined>';
		}

		if (v instanceof Error) {
			return {name: v.name, message: v.message, ...v};
		}

		return v;
	}, 2);
}

// What a page's console.log calls print, line for line.
async function logsOf(fn) {
	const lines = [];
	const original = console.log;
	console.log = (...args) => lines.push(util.format(...args));
	try {
		await fn();
	} catch (error) {
		lines.push(`${error?.name}: ${error?.message}`);
	} finally {
		console.log = original;
	}

	return lines.join('\n');
}

function run(file, args, {cwd = process.cwd(), env = {}, shell = false, input = ''} = {}) {
	return new Promise(resolve => {
		const child = spawn(file, args, {cwd, env: {...process.env, ...env}, shell});
		child.stdin.end(input);
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', chunk => {
			stdout += chunk;
		});
		child.stderr.on('data', chunk => {
			stderr += chunk;
		});
		child.on('error', error => resolve({code: `spawn error ${error.code}`, stdout, stderr}));
		child.on('close', code => {
			resolve({code, stdout: stdout.replaceAll('\r\n', '\n'), stderr: stderr.replaceAll('\r\n', '\n')});
		});
	});
}

// node_modules/.bin first, so `format-json-files` in a shell is the installed bin, as in an npm script.
const BIN_PATH = path.join(HERE, 'node_modules', '.bin');
function shell(script, {env = {}, ...options} = {}) {
	return run(process.env.BASH || 'bash', ['-c', `echo "shell node: $(node --version)"; ${script}`], {
		...options,
		env: {PATH: `${BIN_PATH}${path.delimiter}${process.env.PATH}`, ...env},
	});
}

// A terminal transcript as a page shows it: each command after `$ `, then what it printed, stdout and stderr merged in
// the order they were written (2>&1 into one pipe), then `$ echo $?` and the last command's exit code (after every
// command with {codes: true}). `commands` is one command or a list. `prelude` runs first and is not shown (a shell
// function standing in for a package manager run through corepack, or for 1.0.6's bin).
const quote = text => `'${text.replaceAll("'", "'\\''")}'`;
async function term(commands, {prelude = '', codes = false, ...options} = {}) {
	const list = Array.isArray(commands) ? commands : [commands];
	const script = [prelude, ...list.flatMap((command, index) => [
		`printf '%s\\n' ${quote(`$ ${command}`)}`,
		`{ ${command}\n} 2>&1`,
		codes || index === list.length - 1 ? 'printf \'$ echo $?\\n%s\\n\' "$?"' : ':',
	])].join('\n');
	const result = await shell(script, options);
	return `${result.stdout.replace(/\n$/u, '')}${result.stderr ? `\n(shell stderr) ${result.stderr}` : ''}`;
}

async function capture(label, fn) {
	try {
		show(label, await fn());
	} catch (error) {
		show(`${label} (threw)`, `${error?.name}: ${error?.message}`);
	}
}

const inTree = async (label, spec, fn, options) => show(label, await treeCase(spec, fn, options));
// 1.0.6's bin crashes with a stack trace naming this machine's paths and Node's internals: keep the error lines only.
const trimStack = text => text.split('\n').filter(line => !/^\s+at |^Node\.js v|old106|^\s+throw |^\s+\^$|^$/u.test(line)).join('\n');
const lib = fn => ({root}) => logsOf(fn);
const errorOf = fn => {
	try {
		return `returned ${util.inspect(fn())}`;
	} catch (error) {
		return `${error.name}: ${error.message}`;
	}
};

// ----- the installed package: version, both module systems, the bin -----
const pkgDir = path.join(HERE, 'node_modules', PACKAGE);
const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
if (pkg.version !== VERSION) {
	throw new Error(`installed ${pkg.version}, expected ${VERSION}`);
}

show('installed', `${PACKAGE}@${pkg.version} on Node ${process.version}, ${process.platform}`);
const esm = await import(PACKAGE);
const cjs = require(PACKAGE);
show('esm exports', Object.keys(esm).sort());
show('cjs exports', Object.keys(cjs).sort());
show('api: shapes', [
	`typeof require('format-json-files'): ${typeof cjs}`,
	`require(...).default === require(...): ${cjs.default === cjs}`,
	`require(...).formatJsonFiles === require(...): ${cjs.formatJsonFiles === cjs}`,
	`import default === named import: ${esm.default === esm.formatJsonFiles}`,
	`function length: ${esm.default.length}`,
	`engines: ${JSON.stringify(pkg.engines)}, bin: ${JSON.stringify(pkg.bin)}, dependencies: ${JSON.stringify(pkg.dependencies ?? {})}`,
].join('\n'));
const format = esm.default;

// ----- Home -----
await inTree('home: command line', {'data/settings.json': '{"name":"demo","tags":["a","b"],"size":3}', 'data/notes.txt': 'not JSON'},
	({root}) => term('format-json-files data', {cwd: root}));
await inTree('home: library', {'data/settings.json': '{"name":"demo","size":3}', 'data/done.json': '{\n    "ok": true\n}', 'data/broken.json': '{"a":'},
	lib(() => console.log(format('data'))), {chdir: true});

// ----- Getting started -----
const APP_MJS = "import formatJsonFiles from 'format-json-files';\n\nconst report = formatJsonFiles('data');\nconsole.log(report);\n";
const APP_CJS = "const formatJsonFiles = require('format-json-files');\n\nconsole.log(formatJsonFiles('data', {indent: 2, sortKeys: true}));\n";
const APP_NAMED = "import {formatJsonFiles} from 'format-json-files';\n\nconsole.log(formatJsonFiles('config.json').changed);\n";
await inTree('getting-started: esm', {'app.mjs': APP_MJS, 'data/a.json': '{"b":1,"a":[1,2]}'}, ({root}) => term('node app.mjs', {cwd: root}));
await inTree('getting-started: cjs', {'app.cjs': APP_CJS, 'data/a.json': '{"b":1,"a":[1,2]}'}, ({root}) => term('node app.cjs', {cwd: root}));
await inTree('getting-started: named export', {'app.mjs': APP_NAMED, 'config.json': '{"port":8080}'}, ({root}) => term('node app.mjs', {cwd: root}));
const APP_TS = "import formatJsonFiles, {type FormatOptions, type FormatReport} from 'format-json-files';\n\nconst options: FormatOptions = {indent: 2, check: true};\nconst report: FormatReport = formatJsonFiles('data', options);\nconsole.log(report.changed.length);\n";
const APP_TS_BAD = "import formatJsonFiles from 'format-json-files';\n\nformatJsonFiles('data', {indent: 'tab'});\n";
await inTree('getting-started: typescript', {'app.ts': APP_TS, 'bad.ts': APP_TS_BAD},
	({root}) => term(['tsc --version', 'tsc --noEmit --strict --module nodenext --moduleResolution nodenext app.ts', 'tsc --noEmit --strict --module nodenext --moduleResolution nodenext bad.ts'], {cwd: root, codes: true}));
// The Linux run gets npm 11.16.0 from the registry's npm package through two shims (linux-run.sh).
await inTree('getting-started: npx (installed)', {'data/a.json': '{"b":1}'}, ({root}) => term('npx format-json-files data', {cwd: root}));
show('getting-started: node that npx runs', (await term(['npm --version', 'npm exec -c "node --version"'])).split('\n').slice(1).join('\n'));
await inTree('getting-started: npx without installing', {'data/a.json': '{"b":1}'}, ({root}) => term('npx --yes format-json-files@2.0.0 data', {cwd: root}), {base: path.resolve(HERE, '..', 'noinstall', 'trees')});

// The same `npx format-json-files data` run with this process's Node (L-118: npx.cmd runs the node.exe beside it).
await inTree('getting-started: npx case with process.execPath', {'data/a.json': '{"b":1}'},
	async ({root}) => `node ${process.version}\n${await term(`"${process.execPath.replaceAll('\\', '/')}" "${path.join(pkgDir, pkg.bin[PACKAGE]).replaceAll('\\', '/')}" data`, {cwd: root})}`
		.replace(/\$ "[^\n]*" data/u, '$ <node> <bin> data'));

// Package managers and runtimes, each in its own scratch project (Windows run only: the binaries are Windows ones).
const PM = path.resolve(HERE, '..', 'pm');
async function project(name, packageJson, install) {
	const folder = path.join(PM, name);
	if (!existsSync(path.join(folder, 'installed.txt'))) {
		rmSync(folder, {recursive: true, force: true});
		mkdirSync(folder, {recursive: true});
		writeFileSync(path.join(folder, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
		const result = await shell(install, {cwd: folder, env: {COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'}});
		writeFileSync(path.join(folder, 'installed.txt'), `exit ${result.code}\n${result.stdout}${result.stderr}`);
	}

	return folder;
}

const RT = process.env.RT;
const rtBin = name => `"${path.join(RT, 'node_modules', '.bin', name).replaceAll('\\', '/')}"`;
if (WINDOWS && !process.env.WIKI_VERIFY_CHILD_SKIP_PM) {
	const PNPM = 'pnpm() { corepack pnpm@10.34.5 "$@"; }';
	const YARN = 'yarn() { corepack yarn@4.18.1 "$@"; }';
	const pnpmDir = await project('pnpm', {name: 'try-pnpm', private: true}, `${PNPM}\npnpm add format-json-files@2.0.0`);
	show('getting-started: pnpm install', `${readFileSync(path.join(pnpmDir, 'installed.txt'), 'utf8').split('\n')[0]}\n${(await term('pnpm --version && pnpm list --depth 0', {cwd: pnpmDir, prelude: PNPM})).split('\n').slice(1).join('\n')}`);
	await inTree('getting-started: pnpm exec', {'data/a.json': '{"b":1,"a":2}'}, ({root}) => term('pnpm exec format-json-files data', {cwd: root, prelude: PNPM}), {base: path.join(pnpmDir, 'trees')});
	await inTree('getting-started: pnpm app', {'app.mjs': APP_MJS, 'data/a.json': '{"b":1}'}, ({root}) => term('node app.mjs', {cwd: root}), {base: path.join(pnpmDir, 'trees')});

	const yarnDir = await project('yarn', {name: 'try-yarn', private: true, packageManager: 'yarn@4.18.1'}, `${YARN}\nyarn add format-json-files@2.0.0`);
	show('getting-started: yarn install', `${readFileSync(path.join(yarnDir, 'installed.txt'), 'utf8').split('\n')[0]}\nnode_modules: ${existsSync(path.join(yarnDir, 'node_modules', PACKAGE)) ? 'has the package' : 'none (Plug\'n\'Play)'}\n${(await term('yarn --version', {cwd: yarnDir, prelude: YARN})).split('\n').slice(1).join('\n')}`);
	await inTree('getting-started: yarn run the bin', {'data/a.json': '{"b":1,"a":2}'}, ({root}) => term('yarn format-json-files data', {cwd: root, prelude: YARN}), {base: path.join(yarnDir, 'trees')});
	await inTree('getting-started: yarn node app', {'app.mjs': APP_MJS, 'data/a.json': '{"b":1}'}, ({root}) => term(['node app.mjs', 'yarn node app.mjs'], {cwd: root, prelude: YARN, codes: true}), {base: path.join(yarnDir, 'trees')});

	if (RT) {
		const BUN = `bun() { ${rtBin('bun')} "$@"; }\nbunx() { ${rtBin('bun')} x "$@"; }`;
		const DENO = `deno() { ${rtBin('deno')} "$@"; }`;
		show('getting-started: runtime versions', (await term('bun --version && deno --version', {prelude: `${BUN}\n${DENO}`})).split('\n').slice(1).join('\n'));
		const bunDir = await project('bun', {name: 'try-bun', private: true}, `${BUN}\nbun add format-json-files@2.0.0`);
		show('getting-started: bun install', readFileSync(path.join(bunDir, 'installed.txt'), 'utf8').split('\n')[0]);
		await inTree('getting-started: bun app', {'app.mjs': APP_MJS, 'data/a.json': '{"b":1}'}, ({root}) => term('bun app.mjs', {cwd: root, prelude: BUN}), {base: path.join(bunDir, 'trees')});
		await inTree('getting-started: bun app.cjs', {'app.cjs': APP_CJS, 'data/a.json': '{"b":1,"a":[1,2]}'}, ({root}) => term('bun app.cjs', {cwd: root, prelude: BUN}), {base: path.join(bunDir, 'trees')});
		await inTree('getting-started: bun x (installed)', {'data/a.json': '{"b":1}'}, ({root}) => term('bun x format-json-files data', {cwd: root, prelude: BUN}), {base: path.join(bunDir, 'trees')});

		const DENO_APP = "import formatJsonFiles from 'npm:format-json-files@2.0.0';\n\nconsole.log(formatJsonFiles('data'));\n";
		await inTree('getting-started: deno app', {'app.mjs': DENO_APP, 'data/a.json': '{"b":1}'}, ({root}) => term('deno run --allow-read --allow-write app.mjs', {cwd: root, prelude: DENO}));
		await inTree('getting-started: deno app, read only', {'app.mjs': DENO_APP, 'data/a.json': '{"b":1}'}, ({root}) => term('deno run --allow-read app.mjs', {cwd: root, prelude: DENO}));
		await inTree('getting-started: deno app, no permissions', {'app.mjs': DENO_APP, 'data/a.json': '{"b":1}'}, ({root}) => term('deno run app.mjs', {cwd: root, prelude: DENO}));
		await inTree('getting-started: deno bin', {'data/a.json': '{"b":1}'}, ({root}) => term('deno run --allow-read --allow-write npm:format-json-files@2.0.0 data', {cwd: root, prelude: DENO}));
	}

	// Without installing: a folder with no package.json above it.
	const bare = {base: path.resolve(HERE, '..', 'noinstall', 'trees')};
	await inTree('getting-started: pnpm dlx', {'data/a.json': '{"b":1}'}, ({root}) => term('pnpm dlx format-json-files@2.0.0 data', {cwd: root, prelude: PNPM}), bare);
	await inTree('getting-started: yarn dlx', {'data/a.json': '{"b":1}'}, ({root}) => term('yarn dlx format-json-files@2.0.0 data', {cwd: root, prelude: YARN}), bare);
	if (RT) {
		await inTree('getting-started: bunx', {'data/a.json': '{"b":1}'}, ({root}) => term('bunx format-json-files@2.0.0 data', {cwd: root, prelude: `bunx() { ${rtBin('bun')} x "$@"; }`}), bare);
	}
} else {
	show('getting-started: package managers and runtimes', 'not run here: Windows binaries only (the Windows run has them)');
}

// ----- API reference -----
const MIXED = {'data/raw.json': '{"b":1,"a":[1,2]}', 'data/done.json': '{\n    "ok": true\n}', 'data/id.json': '{"id":12345678901234567890}', 'data/notes.md': '# notes'};
await inTree('api: report', MIXED, lib(() => console.log(format('data'))), {chdir: true});
// The kit masks the tree's path as printed, not util.inspect's escaped form (doubled backslashes on Windows).
await inTree('api: report, absolute path', {'data/raw.json': '{"b":1}'}, async ({root}) => (await logsOf(() => console.log(format(path.join(root, 'data')))))
	.replaceAll(root.replaceAll('\\', '\\\\'), '<tree>'));
const SAMPLE = '{"b":1,"a":[1,{"c":null}],"s":"x"}';
for (const [name, options] of [
	['indent 2', {indent: 2}],
	['indent tab', {indent: '\t'}],
	['sortKeys', {sortKeys: true}],
	['finalNewline', {finalNewline: true}],
	['eol crlf', {eol: 'crlf'}],
]) {
	await inTree(`api: option ${name}`, {'a.json': SAMPLE}, lib(() => console.log(format('a.json', options))), {chdir: true});
}

await inTree('api: option indent 0', {'a.json': '{ "b": 1, "a": [ 1, { "c": null } ] }'}, lib(() => console.log(format('a.json', {indent: 0}))), {chdir: true});
await inTree('api: option check', {'raw.json': SAMPLE, 'done.json': '{\n    "ok": true\n}', 'bad.json': '{'}, lib(() => console.log(format('.', {check: true}))), {chdir: true});
await inTree('api: option eol auto', {'crlf.json': '{\r\n  "a": 1\r\n}\r\n', 'lf.json': '{\n  "a": 1\n}\n', 'mixed.json': '{"a":1,\r\n"b":2}\n'},
	lib(() => console.log(format('.', {eol: 'auto', finalNewline: true}))), {chdir: true});
const IGNORE_TREE = {'src/a.json': '{"a":1}', 'dist/b.json': '{"b":1}', 'node_modules/p/package.json': '{"name":"p"}', '.git/c.json': '{"c":1}'};
await inTree('api: option ignore default', IGNORE_TREE, lib(() => console.log(format('.', {check: true}).changed)), {chdir: true});
await inTree('api: option ignore dist', IGNORE_TREE, lib(() => console.log(format('.', {ignore: ['dist'], check: true}).changed)), {chdir: true});
await inTree('api: option ignore keep defaults', IGNORE_TREE, lib(() => console.log(format('.', {ignore: ['node_modules', '.git', 'dist'], check: true}).changed)), {chdir: true});
await inTree('api: option ignore none', IGNORE_TREE, lib(() => console.log(format('.', {ignore: [], check: true}).changed)), {chdir: true});
await inTree('api: ignored name given as the path', IGNORE_TREE, lib(() => console.log(format('node_modules', {check: true}).changed)), {chdir: true});
await inTree('api: errors', {'a.json': '{"a":1}'}, () => [
	['formatJsonFiles()', () => format()],
	["formatJsonFiles('')", () => format('')],
	['formatJsonFiles(null)', () => format(null)],
	['formatJsonFiles(123)', () => format(123)],
	["formatJsonFiles(['a.json'])", () => format(['a.json'])],
	["formatJsonFiles('missing')", () => format('missing')],
	["formatJsonFiles('missing.json')", () => format('missing.json')],
	["formatJsonFiles('a.json', {indent: 11})", () => format('a.json', {indent: 11})],
	["formatJsonFiles('a.json', {indent: '2'})", () => format('a.json', {indent: '2'})],
	["formatJsonFiles('a.json', {indent: 2.5})", () => format('a.json', {indent: 2.5})],
	["formatJsonFiles('a.json', {indent: 'tab'})", () => format('a.json', {indent: 'tab'})],
	["formatJsonFiles('a.json', {sortKeys: 'yes'})", () => format('a.json', {sortKeys: 'yes'})],
	["formatJsonFiles('a.json', {check: 1})", () => format('a.json', {check: 1})],
	["formatJsonFiles('a.json', {finalNewline: null})", () => format('a.json', {finalNewline: null})],
	["formatJsonFiles('a.json', {eol: 'CRLF'})", () => format('a.json', {eol: 'CRLF'})],
	["formatJsonFiles('a.json', {ignore: 'dist'})", () => format('a.json', {ignore: 'dist'})],
	["formatJsonFiles('a.json', {ignore: [1]})", () => format('a.json', {ignore: [1]})],
	["formatJsonFiles('missing', {indent: 11})", () => format('missing', {indent: 11})],
	["formatJsonFiles('a.json', {check: true, unknown: 1})", () => format('a.json', {check: true, unknown: 1})],
	["formatJsonFiles('a.json', 'ignored')", () => format('a.json', 'ignored')],
].map(([call, fn]) => `${call}\n  ${errorOf(fn)}`).join('\n'), {chdir: true});
await inTree('api: forEach passes an index, ignored', {'a.json': '{"a":1}', 'b.json': '{"b":2}'},
	lib(() => ['a.json', 'b.json'].forEach(file => console.log(file, format(file, 0).changed.length))), {chdir: true});
await inTree('api: forEach(formatJsonFiles)', {'a.json': '{"a":1}', 'b.json': '{"b":2}'}, lib(() => {
	['a.json', 'b.json'].forEach(format);
	console.log('done');
}), {chdir: true});
await inTree('api: cjs build gives the same report', MIXED, lib(() => console.log(cjs('data'))), {chdir: true});

// ----- How files are formatted (the behaviour page) -----
await inTree('format: default output', {'a.json': '{"name":"demo","list":[1,2,{"x":null}],"empty":{},"none":[]}'}, ({root}) => term('format-json-files a.json', {cwd: root}));
await inTree('format: already formatted files are not written', {'done.json': '{\n    "a": 1\n}', 'raw.json': '{"a":1}', 'newline.json': '{\n    "a": 1\n}\n'},
	lib(() => console.log(format('.'))), {chdir: true});
await inTree('format: second run', {'a.json': '{"a":[1,2]}'}, lib(() => {
	console.log(format('.'));
	console.log(format('.'));
}), {chdir: true});
await inTree('format: numbers', {'numbers.json': '{"int":1,"float":1.5,"trailing":1.0,"exp":1e5,"exp2":1E+2,"neg":-3,"small":0.1,"tiny":5e-324,"avogadro":6.02e23,"precise":0.1000000000000000055511151231257827,"safe":9007199254740991}'},
	({root}) => term('format-json-files numbers.json', {cwd: root}));
await inTree('format: key order', {'keys.json': '{"b":1,"a":2,"10":3,"2":4,"B":5,"c":{"z":1,"y":2},"list":[3,1,2]}'}, ({root}) => term('format-json-files keys.json', {cwd: root}));
await inTree('format: key order, sorted', {'keys.json': '{"b":1,"a":2,"10":3,"2":4,"B":5,"c":{"z":1,"y":2},"list":[3,1,2]}'}, ({root}) => term('format-json-files --sort-keys keys.json', {cwd: root}));
// The editor tool decoded this line's \u escapes (L-001); STRINGS below replaces it.
const DISCARDED = String.raw`{"slash":"a\/b","unicode":"é","control":"\u0001","tab":"a\tb","quote":"\"","emoji":"😀","sep":" "}`;
void DISCARDED;
// Written with <BS> for each backslash, replaced here.
const STRINGS = '{"slash":"a<BS>/b","unicode":"<BS>u00e9","control":"<BS>u0001","tab":"a<BS>tb","quote":"<BS>"","emoji":"<BS>ud83d<BS>ude00","plain":"e-acute"}'
	.replaceAll('<BS>', String.fromCharCode(92));
await inTree('format: strings', {'strings.json': STRINGS}, ({root}) => term('format-json-files strings.json', {cwd: root}));
// U+2028 cannot be shown on a page: print the written bytes in hex.
await inTree('format: line separator', {'sep.json': '{"sep":"<BS>u2028"}'.replaceAll('<BS>', String.fromCharCode(92))}, async ({root}) => {
	const transcript = await term('format-json-files sep.json', {cwd: root});
	return `${transcript}\nbytes after: ${readFileSync(path.join(root, 'sep.json')).toString('hex').match(/../gu).join(' ')}`;
});
await inTree('format: whitespace around', {'ws.json': '  \n {"a":1} \n\n'}, ({root}) => term('format-json-files ws.json', {cwd: root}));
await inTree('format: scalars', {'string.json': '"text"', 'number.json': '42', 'null.json': 'null', 'array.json': '[]', 'object.json': '{}'},
	({root}) => term('format-json-files .', {cwd: root}));
await inTree('format: values that would change', {
	'id.json': '{"id":12345678901234567890}',
	'exact.json': '{"n":1152921504606846976}',
	'e21.json': '{"n":1000000000000000000000}',
	'dup.json': '{"a":1,"b":2,"a":3}',
	'negzero.json': '{"z":-0}',
	'negzero-float.json': '{"z":-0.0}',
	'huge.json': '{"x":1e400}',
	'tiny.json': '{"x":1e-400}',
	'ok.json': '{"x":6.02e23,"y":0.1000000000000000055,"z":0e5}',
}, ({root}) => term('format-json-files .', {cwd: root}));
await inTree('format: long reasons are cut', {'long.json': `[${'1'.repeat(60)}]`, 'key.json': `{"${'k'.repeat(50)}":1,"${'k'.repeat(50)}":2}`}, ({root}) => term('format-json-files .', {cwd: root}));
await inTree('format: which files a folder walk picks', {
	'lower.json': '{"a":1}', 'UPPER.JSON': '{"a":1}', 'Mixed.Json': '{"a":1}', '.json': '{"a":1}', 'no-extension': '{"a":1}',
	'data.txt': '{"a":1}', 'data.jsonc': '{"a":1}', 'data.json5': '{"a":1}', 'data.json.bak': '{"a":1}', 'data.geojson': '{"a":1}',
	'dir.json/inner.json': '{"a":1}', 'with space.json': '{"a":1}', 'sub/deeper/deepest/leaf.json': '{"a":1}',
	'node_modules/pkg/package.json': '{"name":"pkg"}', 'sub/node_modules/x.json': '{"a":1}', '.git/config.json': '{"a":1}', '.hidden/h.json': '{"a":1}',
}, ({root}) => term('format-json-files --check .', {cwd: root}));
await inTree('format: report order', {'b.json': '{"a":1}', 'a/z.json': '{"a":1}', 'A.json': '{"a":1}', 'c.json': '{"a":1}'}, lib(() => console.log(format('.').changed)), {chdir: true});

// ----- Commands -----
show('commands: help', await term('format-json-files --help'));
show('commands: version', await term(['format-json-files --version', 'format-json-files -v']));
const TREE = {'data/a.json': '{"b":1,"a":[1,2]}', 'data/nested/b.json': '{"ok":true}', 'data/c.json': '{\n    "done": 1\n}', 'data/readme.txt': 'hello'};
await inTree('commands: a folder', TREE, ({root}) => term('format-json-files data', {cwd: root}));
await inTree('commands: a file', TREE, ({root}) => term('format-json-files data/a.json', {cwd: root}));
await inTree('commands: a file with another name', {'settings.txt': '{"a":1}', '.eslintrc': '{"rules":{}}'}, ({root}) => term('format-json-files settings.txt .eslintrc', {cwd: root}));
await inTree('commands: several paths', {'a.json': '{"a":1}', 'more/b.json': '{"b":2}', 'other/c.json': '{"c":3}'}, ({root}) => term('format-json-files a.json more other', {cwd: root}));
await inTree('commands: a glob the shell expands', TREE, ({root}) => term('format-json-files data/*.json', {cwd: root}));
await inTree('commands: globstar', TREE, ({root}) => term(['shopt -s globstar', 'format-json-files data/**/*.json'], {cwd: root}));
await inTree('commands: a quoted glob', TREE, ({root}) => term("format-json-files 'data/*.json'", {cwd: root}));
if (WINDOWS) {
	await inTree('commands: a glob in PowerShell', TREE, async ({root}) => {
		const result = await run('pwsh', ['-NoProfile', '-Command', 'format-json-files data/*.json'], {cwd: root, env: {PATH: `${BIN_PATH}${path.delimiter}${process.env.PATH}`}});
		const version = await run('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']);
		return `PowerShell ${version.stdout.trim()}\nPS> format-json-files data/*.json\n${result.stdout}${result.stderr}PS> $LASTEXITCODE\n${result.code}`;
	});
} else {
	show('commands: a glob in PowerShell', 'not run: Windows only');
}

await inTree('commands: check', TREE, ({root}) => term('format-json-files --check data', {cwd: root}));
await inTree('commands: check when formatted', {'a.json': '{\n    "a": 1\n}'}, ({root}) => term('format-json-files --check .', {cwd: root}));
await inTree('commands: check with a skipped file', {'a.json': '{"a":1}', 'bad.json': '{"a":'}, ({root}) => term('format-json-files --check .', {cwd: root}));
await inTree('commands: sort keys, indent 2', {'config.json': '{"z":1,"a":{"y":2,"b":3}}'}, ({root}) => term('format-json-files --sort-keys --indent 2 config.json', {cwd: root}));
await inTree('commands: indent tab', {'a.json': '{"a":[1]}'}, ({root}) => term('format-json-files --indent tab a.json', {cwd: root}));
await inTree('commands: indent 0', {'a.json': '{ "a" : [ 1 , 2 ] }'}, ({root}) => term('format-json-files --indent 0 a.json', {cwd: root}));
await inTree('commands: final newline', {'a.json': '{"a":1}'}, ({root}) => term('format-json-files --final-newline a.json', {cwd: root}));
await inTree('commands: eol crlf', {'a.json': '{"a":1}'}, ({root}) => term('format-json-files --eol crlf --final-newline a.json', {cwd: root}));
await inTree('commands: eol auto', {'crlf.json': '{"a":1,\r\n"b":2}', 'lf.json': '{"a":1,\n"b":2}'}, ({root}) => term('format-json-files --eol auto .', {cwd: root}));
await inTree('commands: ignore', IGNORE_TREE, ({root}) => term('format-json-files --check --ignore dist .', {cwd: root}));
await inTree('commands: ignore twice', IGNORE_TREE, ({root}) => term('format-json-files --check --ignore dist --ignore node_modules .', {cwd: root}));
await inTree('commands: no-ignore', IGNORE_TREE, ({root}) => term('format-json-files --check --no-ignore .', {cwd: root}));
await inTree('commands: flags after the path', {'a.json': '{"b":1,"a":2}'}, ({root}) => term('format-json-files a.json --sort-keys', {cwd: root}));
await inTree('commands: a skipped file', {'good.json': '{"a":1}', 'bad.json': '{"a":', 'id.json': '[12345678901234567890]'}, ({root}) => term('format-json-files .', {cwd: root}));
await inTree('commands: no path', {'a.json': '{"a":1}'}, ({root}) => term('format-json-files', {cwd: root}));
await inTree('commands: a missing path', {'a.json': '{"a":1}'}, ({root}) => term('format-json-files missing a.json', {cwd: root}));
for (const args of ['--nope .', '--indent 11 .', '--indent x .', '--indent', '--indent -1 .', '--indent=-1 .', '--eol cr .', '--check=yes .', '-x .']) {
	// eslint-disable-next-line no-await-in-loop
	await inTree(`commands: usage error ${args}`, {'a.json': '{"a":1}'}, ({root}) => term(`format-json-files ${args}`, {cwd: root}));
}

await inTree('commands: a path that starts with a dash', {'-odd.json': '{"a":1}'}, ({root}) => term('format-json-files -- -odd.json', {cwd: root}));
await inTree('commands: help wins over paths', {'a.json': '{"a":1}'}, ({root}) => term('format-json-files --help a.json | head -3', {cwd: root}));

// ----- Edge cases and errors -----
await inTree('edge: byte order mark', {'bom.json': `${BOM}{"a":1}`}, ({root}) => term('format-json-files bom.json', {cwd: root}));
await inTree('edge: byte order mark, formatted text', {'bom.json': `${BOM}{\n    "a": 1\n}`}, ({root}) => term('format-json-files bom.json', {cwd: root}));
await inTree('edge: utf-16', {'utf16.json': Buffer.from(`${BOM}{"a":1}`, 'utf16le')}, ({root}) => term('format-json-files utf16.json', {cwd: root}));
await inTree('edge: latin-1', {'latin1.json': Buffer.from([0x7B, 0x22, 0x61, 0x22, 0x3A, 0x22, 0xE9, 0x22, 0x7D])}, ({root}) => term('format-json-files latin1.json', {cwd: root}));
await inTree('edge: crlf', {'crlf.json': '{\r\n  "a": 1,\r\n  "b": [2]\r\n}\r\n'}, ({root}) => term('format-json-files crlf.json', {cwd: root}));
await inTree('edge: crlf kept', {'crlf.json': '{\r\n  "a": 1,\r\n  "b": [2]\r\n}\r\n'}, ({root}) => term('format-json-files --eol auto --final-newline crlf.json', {cwd: root}));
await inTree('edge: not JSON', {
	'comments.json': '{\n  // a comment\n  "a": 1\n}',
	'block-comment.json': '{"a": 1 /* note */}',
	'trailing-comma.json': '{"a":1,}',
	'trailing-comma-array.json': '[1,2,]',
	'single-quotes.json': "{'a':1}",
	'empty.json': '',
	'whitespace-only.json': ' \n',
	'truncated.json': '{"a":[1,2',
	'two-values.json': '{"a":1}{"b":2}',
	'nan.json': '{"a":NaN}',
	'unquoted-key.json': '{a:1}',
}, ({root}) => term('format-json-files .', {cwd: root}));
await inTree('edge: deep nesting', {'deep-5000.json': `${'['.repeat(5000)}${']'.repeat(5000)}`, 'deep-10000.json': `${'['.repeat(10_000)}${']'.repeat(10_000)}`, 'after.json': '{"a":1}'},
	lib(() => console.log(format('.'))), {chdir: true});
// The deepest array nesting this Node formats, by bisection with check: true (nothing written).
await inTree('edge: nesting limit', {}, ({root}) => {
	const file = path.join(root, 'deep.json');
	const formats = depth => {
		writeFileSync(file, `${'['.repeat(depth)}${']'.repeat(depth)}`);
		return format(file, {check: true}).skipped.length === 0;
	};

	let low = 1;
	let high = 10_000;
	while (high - low > 1) {
		const middle = Math.floor((low + high) / 2);
		if (formats(middle)) {
			low = middle;
		} else {
			high = middle;
		}
	}

	const inProcess = `deepest formatted: ${low}, first skipped: ${high} (in-process, default stack)`;
	return (async () => {
		// The same through the bin, one process per depth: nothing on stderr means the file could be formatted.
		const cliFormats = async depth => {
			writeFileSync(file, `${'['.repeat(depth)}${']'.repeat(depth)}`);
			return (await run(process.execPath, [path.join(pkgDir, pkg.bin[PACKAGE]), '--check', file])).stderr === '';
		};

		let low = 1;
		let high = 20_000;
		while (high - low > 1) {
			const middle = Math.floor((low + high) / 2);
			// eslint-disable-next-line no-await-in-loop
			if (await cliFormats(middle)) {
				low = middle;
			} else {
				high = middle;
			}
		}

		// Removed so the kit's file list stays empty (a created file would print its 9 KB of brackets).
		rmSync(file);
		return `${inProcess}\ndeepest formatted: ${low}, first skipped: ${high} (format-json-files --check, default stack)`;
	})();
});
await inTree('edge: read-only file',{'locked.json': {content: '{"a":1}', readonly: true}, 'locked-done.json': {content: '{\n    "a": 1\n}', readonly: true}, 'open.json': '{"a":1}'},
	({root}) => term('format-json-files .', {cwd: root}));
await inTree('edge: read-only file, check', {'locked.json': {content: '{"a":1}', readonly: true}}, ({root}) => term('format-json-files --check .', {cwd: root}));
await inTree('edge: symbolic link to a file', {'outside/target.json': '{"a":1}', 'inside/plain.json': '{"b":2}', 'inside/link.json': {symlink: '../outside/target.json'}},
	({root}) => term(['format-json-files inside', 'format-json-files inside/link.json'], {cwd: root, codes: true}));
await inTree('edge: link to a folder', root => {
	for (const [file, text] of [['outside/o.json', '{"o":1}'], ['inside/i.json', '{"i":1}']]) {
		mkdirSync(path.join(root, path.dirname(file)), {recursive: true});
		writeFileSync(path.join(root, file), text);
	}

	symlinkSync(WINDOWS ? path.join(root, 'outside') : '../outside', path.join(root, 'inside', 'linked'), WINDOWS ? 'junction' : 'dir');
}, async ({root}) => `link type: ${WINDOWS ? 'junction' : 'symbolic link to a folder'}\n${await term(['format-json-files inside', 'format-json-files inside/linked', 'format-json-files inside/linked/o.json'], {cwd: root, codes: true})}`);
await inTree('edge: hard link', root => {
	writeFileSync(path.join(root, 'a.json'), '{"a":1}');
	mkdirSync(path.join(root, 'elsewhere'));
	linkSync(path.join(root, 'a.json'), path.join(root, 'elsewhere', 'same.json'));
}, ({root}) => term('format-json-files a.json', {cwd: root}));
await inTree('edge: a directory named like a file', {'dir.json/inner.json': '{"a":1}'}, ({root}) => term('format-json-files dir.json', {cwd: root}));
await inTree('edge: a file that is not JSON given by name', {'README.md': '# Title', 'data.csv': 'a,b\n1,2'}, ({root}) => term('format-json-files README.md data.csv', {cwd: root}));
await inTree('edge: missing paths', {'a.json': '{"a":1}'}, ({root}) => term(['format-json-files missing.json', 'format-json-files missing/'], {cwd: root, codes: true}));
await inTree('edge: an empty folder', {'empty': {dir: true}}, ({root}) => term('format-json-files empty', {cwd: root}));
if (WINDOWS) {
	show('edge: unreadable folder', 'not run: POSIX modes (Linux run)');
} else {
	await inTree('edge: unreadable folder', {'shut/a.json': '{"a":1}', 'b.json': '{"b":1}'}, async ({root}) => {
		chmodSync(path.join(root, 'shut'), 0o000);
		try {
			// WSL's drvfs (/mnt/c) ignores a folder's mode: say so rather than print a run that proves nothing.
			const probe = await run('ls', [path.join(root, 'shut')]);
			if (probe.code === 0) {
				return 'not tested: this file system ignores folder modes (WSL drvfs); the repository\'s walk test covers it on Linux CI';
			}

			return await term('format-json-files .', {cwd: root});
		} finally {
			chmodSync(path.join(root, 'shut'), 0o755);
		}
	});
}

// ----- Recipes -----
await inTree('recipes: ci check', {'config/app.json': '{"port":8080}', 'config/ok.json': '{\n    "ok": true\n}'}, ({root}) => term('format-json-files --check config', {cwd: root}));
await inTree('recipes: npm script', {
	'package.json': '{\n  "name": "my-app",\n  "private": true,\n  "scripts": {\n    "format:json": "format-json-files --sort-keys --indent 2 --final-newline config",\n    "check:json": "format-json-files --check --sort-keys --indent 2 --final-newline config"\n  }\n}\n',
	'config/app.json': '{"port":8080,"host":"localhost"}',
}, ({root}) => term(['npm run --silent check:json', 'npm run --silent format:json', 'npm run --silent check:json'], {cwd: root, codes: true}));
// The repository's .git folder lives outside the tree (GIT_DIR, GIT_WORK_TREE), so the file list shows the JSON files only.
const GIT_DIRS = path.join(HERE, 'git-dirs');
await inTree('recipes: only changed files in git', {'a.json': '{"a":1}', 'b.json': '{"b":1}'}, async ({root}) => {
	const gitDir = path.join(GIT_DIRS, path.basename(root));
	mkdirSync(GIT_DIRS, {recursive: true});
	const env = {GIT_DIR: gitDir, GIT_WORK_TREE: root, GIT_AUTHOR_NAME: 'me', GIT_AUTHOR_EMAIL: 'me@example.invalid', GIT_COMMITTER_NAME: 'me', GIT_COMMITTER_EMAIL: 'me@example.invalid'};
	await shell('git init -q && git add . && git commit -q -m files', {cwd: root, env});
	const transcript = await term([
		"printf '{\"a\":2}' > a.json",
		'git status --short',
		"git diff --name-only --diff-filter=d -- '*.json' | xargs -r format-json-files",
		'git diff --stat',
	], {cwd: root, env, codes: true});
	rmSync(gitDir, {recursive: true, force: true});
	return transcript;
});
await inTree('recipes: xargs without -r', {'a.json': '{"a":1}'}, ({root}) => term('printf "" | xargs format-json-files', {cwd: root}));
const BUILD_SCRIPT = [
	"import formatJsonFiles from 'format-json-files';",
	'',
	"const folders = ['config', 'locales'];",
	'const skipped = [];',
	'for (const folder of folders) {',
	'  const report = formatJsonFiles(folder, {indent: 2, finalNewline: true});',
	'  console.log(`${folder}: ${report.changed.length} changed, ${report.unchanged.length} unchanged`);',
	'  skipped.push(...report.skipped);',
	'}',
	'',
	'for (const {path, reason} of skipped) {',
	'  console.error(`${path}: ${reason}`);',
	'}',
	'',
	'process.exitCode = skipped.length > 0 ? 1 : 0;',
	'',
].join('\n');
await inTree('recipes: several folders from a script', {'format-json.mjs': BUILD_SCRIPT, 'config/app.json': '{"a":1}', 'locales/en.json': '{"hi":"Hello"}', 'locales/fr.json': '{"hi":"Bonjour","hi":"Salut"}'},
	({root}) => term('node format-json.mjs', {cwd: root}));
await inTree('recipes: translation files', {'my-folder/my-file.json': '{"welcome":"Welcome","about":"About","nav":{"home":"Home","back":"Back"}}'},
	({root}) => term('format-json-files --sort-keys ./my-folder/my-file.json', {cwd: root}));
await inTree('recipes: editorconfig style', {'a.json': '{"a":[1]}', 'win.json': '{"b":2}\r\n'}, ({root}) => term('format-json-files --indent 2 --final-newline --eol auto .', {cwd: root}));
const CHECK_SCRIPT = [
	"import formatJsonFiles from 'format-json-files';",
	'',
	"const {changed, skipped} = formatJsonFiles('.', {check: true});",
	'for (const file of changed) {',
	'  console.log(`not formatted: ${file}`);',
	'}',
	'',
	'for (const {path, reason} of skipped) {',
	'  console.log(`cannot format: ${path} (${reason})`);',
	'}',
	'',
	'if (changed.length > 0 || skipped.length > 0) {',
	'  process.exitCode = 1;',
	'}',
	'',
].join('\n');
await inTree('recipes: check from a test', {'check-json.mjs': CHECK_SCRIPT, 'a.json': '{"a":1}', 'b.json': '{\n    "b": 1\n}', 'c.json': '{"c":1,"c":2}'},
	({root}) => term('node check-json.mjs', {cwd: root}));

// ----- Versions and upgrading: 1.0.6 side by side (OLD=<folder with format-json-files@1.0.6>) -----
const {GOLDEN, OLD} = process.env;
if (OLD) {
	const oldDir = path.join(OLD, 'node_modules', PACKAGE);
	const oldVersion = JSON.parse(readFileSync(path.join(oldDir, 'package.json'), 'utf8')).version;
	const oldLib = createRequire(path.join(OLD, 'package.json'))(PACKAGE);
	const OLD_CLI = `format-json-files() { node "${path.join(oldDir, 'cli.js').replaceAll('\\', '/')}" "$@"; }`;
	show('versions: old installed', `format-json-files@${oldVersion}`);
	const LOSSY = {'id.json': '{"id":12345678901234567890}', 'dup.json': '{"a":1,"a":2}', 'negzero.json': '{"z":-0}', 'huge.json': '{"x":1e400}', 'latin1.json': Buffer.from([0x7B, 0x22, 0x61, 0x22, 0x3A, 0x22, 0xE9, 0x22, 0x7D]), 'bom.json': `${BOM}{"a":1}`, 'done.json': '{\n    "ok": true\n}'};
	await inTree('versions: 1.0.6 on files that lose data', LOSSY, ({root}) => term('format-json-files .', {cwd: root, prelude: OLD_CLI}));
	await inTree('versions: 2.0.0 on files that lose data', LOSSY, ({root}) => term('format-json-files .', {cwd: root}));
	await inTree('versions: 1.0.6 library', {'a.json': '{"a":1}', 'bad.json': '{'}, lib(() => console.log(oldLib('.'))), {chdir: true});
	await inTree('versions: 2.0.0 library', {'a.json': '{"a":1}', 'bad.json': '{'}, lib(() => console.log(format('.'))), {chdir: true});
	await inTree('versions: 1.0.6 --sort-keys', {'a.json': '{"b":1,"a":2}'}, async ({root}) => trimStack(await term('format-json-files --sort-keys .', {cwd: root, prelude: OLD_CLI})));
	await inTree('versions: 1.0.6 two paths', {'a.json': '{"a":1}', 'b.json': '{"b":1}'}, ({root}) => term('format-json-files a.json b.json', {cwd: root, prelude: OLD_CLI}));
	await inTree('versions: 1.0.6 node_modules', IGNORE_TREE, ({root}) => term('format-json-files .', {cwd: root, prelude: OLD_CLI}));
	await inTree('versions: 2.0.0 --no-ignore', IGNORE_TREE, ({root}) => term('format-json-files --no-ignore .', {cwd: root}));
	await inTree('versions: 1.0.6 symbolic link', {'outside/target.json': '{"a":1}', 'inside/link.json': {symlink: '../outside/target.json'}}, ({root}) => term('format-json-files inside', {cwd: root, prelude: OLD_CLI}));
	await inTree('versions: 1.0.6 missing path', {}, async ({root}) => trimStack(await term('format-json-files missing', {cwd: root, prelude: OLD_CLI})));
	await inTree('versions: 1.0.6 no path', {}, async ({root}) => trimStack(await term('format-json-files', {cwd: root, prelude: OLD_CLI})));
	await inTree('versions: 1.0.6 version and help', {}, ({root}) => term('format-json-files --version', {cwd: root, prelude: OLD_CLI}));
}

// ----- golden capture of 1.0.6, replayed today (L-020, L-113) -----
// GOLDEN=<clone>/test/golden (read only) and OLD as above. The capture runs as a child process, once in OLD against 1.0.6
// unchanged, once here against 2.0.0 with two lines patched (the bin's path, and meow's version for the header), one
// after the other. Its trees go to os.tmpdir(), so TEMP, TMP and TMPDIR point at ./golden-tmp here.
if (GOLDEN && OLD) {
	const files = ['capture-1.0.6.cjs', 'capture-fixtures.cjs', 'codec.cjs'];
	mkdirSync('golden-now', {recursive: true});
	for (const file of files) {
		copyFileSync(path.join(GOLDEN, file), path.join(OLD, file));
		copyFileSync(path.join(GOLDEN, file), path.join('golden-now', file));
	}

	const patches = [
		["const cli = path.join(packageRoot, 'cli.js');", "const cli = path.join(packageRoot, (bin => typeof bin === 'string' ? bin : Object.values(bin)[0])(require('format-json-files/package.json').bin));"],
		["dependencies: {meow: require('meow/package.json').version},", "dependencies: {meow: (() => {\n    try {\n      return require('meow/package.json').version;\n    } catch {\n      return 'none';\n    }\n  })()},"],
	];
	let text = readFileSync(path.join('golden-now', 'capture-1.0.6.cjs'), 'utf8');
	for (const [from, to] of patches) {
		if (!text.includes(from)) {
			throw new Error(`patch target not found: ${from}`);
		}

		text = text.replace(from, to);
	}

	writeFileSync(path.join('golden-now', 'capture-1.0.6.cjs'), text);
	show('golden: patches for 2.0.0', patches.map(([from, to]) => `- ${from}\n+ ${to}`).join('\n'));
	const tmp = path.resolve('golden-tmp');
	mkdirSync(tmp, {recursive: true});
	const tmpEnv = {TEMP: tmp, TMP: tmp, TMPDIR: tmp};
	const want = JSON.parse(readFileSync(path.join(GOLDEN, '1.0.6.json'), 'utf8'));
	const fileBytes = entry => Object.fromEntries(Object.entries(entry.files ?? {}).filter(([, file]) => !file.link).map(([name, file]) => [name, file.bytes]));
	const fileWritten = entry => Object.fromEntries(Object.entries(entry.files ?? {}).filter(([, file]) => !file.link).map(([name, file]) => [name, file.written]));
	const views = {
		'library throws': [entry => entry.kind === 'library' && entry.result?.$throws !== undefined, entry => entry.result],
		'library returns and prints': [entry => entry.kind === 'library' && entry.result?.$throws === undefined, entry => [entry.result, entry.stdout]],
		'files: bytes': [() => true, fileBytes],
		'files: written': [() => true, fileWritten],
		'files: links present': [() => true, entry => Object.keys(entry.files ?? {}).filter(name => entry.files[name].link)],
		'unavailable links': [() => true, entry => entry.unavailable],
		'cli: exit status': [entry => entry.kind === 'cli', entry => entry.status],
		'cli: stdout': [entry => entry.kind === 'cli', entry => entry.stdout],
		'cli: stderr error lines': [entry => entry.kind === 'cli', entry => entry.stderrErrors],
	};
	for (const [label, folder] of [['golden: 1.0.6 today', OLD], [`golden: ${VERSION}`, 'golden-now']]) {
		// eslint-disable-next-line no-await-in-loop
		const result = await run(process.execPath, ['capture-1.0.6.cjs'], {cwd: folder, env: tmpEnv});
		if (result.code !== 0) {
			show(label, `capture failed, exit ${result.code}\n${result.stderr.split('\n').slice(0, 8).join('\n')}`);
			continue;
		}

		const gotAll = JSON.parse(result.stdout);
		const got = new Map(gotAll.cases.map(entry => [entry.id, entry]));
		const lines = [`header: ${gotAll.package}, meow ${gotAll.dependencies.meow}, ${gotAll.platform}`, `${want.cases.length} cases (${want.cases.filter(entry => entry.kind === 'library').length} library, ${want.cases.filter(entry => entry.kind === 'cli').length} cli); ${got.size} replayed`];
		for (const [view, [applies, pick]] of Object.entries(views)) {
			const cases = want.cases.filter(entry => applies(entry));
			const differing = cases.filter(entry => JSON.stringify(pick(got.get(entry.id) ?? {})) !== JSON.stringify(pick(entry)));
			lines.push(`${view}: ${cases.length - differing.length} of ${cases.length} identical${differing.length > 0 ? `; differ: ${differing.map(entry => entry.id).join(' ')}` : ''}`);
			if (view === 'files: bytes') {
				for (const entry of differing) {
					const a = fileBytes(entry);
					const b = fileBytes(got.get(entry.id) ?? {});
					const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(name => JSON.stringify(a[name]) !== JSON.stringify(b[name]));
					lines.push(`  ${entry.id}: ${names.join(', ')}`);
				}
			}

			if (view === 'library returns and prints' && label.includes('1.0.6')) {
				for (const entry of differing) {
					const now = got.get(entry.id)?.stdout ?? [];
					const index = entry.stdout.findIndex((line, at) => line !== now[at]);
					lines.push(`  ${entry.id}: recorded ${JSON.stringify(entry.stdout[index]).slice(0, 110)} | now ${JSON.stringify(now[index]).slice(0, 110)}`);
				}
			}

			if (view === 'cli: stdout' || view === 'cli: stderr error lines' || view === 'cli: exit status') {
				for (const entry of differing) {
					const key = view === 'cli: stdout' ? 'stdout' : (view === 'cli: exit status' ? 'status' : 'stderrErrors');
					lines.push(`  ${entry.id}: recorded ${JSON.stringify(entry[key]).slice(0, 90)} | now ${JSON.stringify(got.get(entry.id)?.[key]).slice(0, 90)}`);
				}
			}
		}

		show(label, lines.join('\n'));
	}
}

// ----- the oldest Node line in engines (L-106, L-118) -----
// OLDEST_NODE=20 reruns this whole script under Node 20 and saves that run as wiki-verify[.linux].node20.out.txt.
// OLDEST_NODE_BIN names the binary when npx cannot fetch it (the Linux run has Node but no npm).
const {OLDEST_NODE, OLDEST_NODE_BIN, WIKI_VERIFY_CHILD} = process.env;
if (OLDEST_NODE && !WIKI_VERIFY_CHILD) {
	let source = OLDEST_NODE_BIN;
	if (!source) {
		const found = await run('npx', ['-y', '-p', `node@${OLDEST_NODE}`, 'node', '-p', 'process.execPath'], {shell: WINDOWS, env: {NODE_OPTIONS: ''}});
		source = found.stdout.trim().split('\n').at(-1);
	}

	// Per platform: the Windows and WSL runs share this folder, and a Linux `node` binary beside node.exe made Git Bash
	// skip the folder and run the system Node 24 in every shell case (the L-118 trap, a second way in).
	const alone = path.resolve(`node${OLDEST_NODE}-alone-${process.platform}`);
	mkdirSync(alone, {recursive: true});
	const oldNode = path.join(alone, path.basename(source));
	copyFileSync(source, oldNode);
	chmodSync(oldNode, 0o755);
	const outName = `wiki-verify.${WINDOWS ? '' : 'linux.'}node${OLDEST_NODE}.out.txt`;
	const rerun = await run(oldNode, [fileURLToPath(import.meta.url)], {env: {WIKI_VERIFY_CHILD: '1', PATH: `${alone}${path.delimiter}${process.env.PATH}`}});
	writeFileSync(outName, rerun.stdout + (rerun.stderr ? `## stderr of the run\n${rerun.stderr}\n` : ''));
	show(`oldest node: node@${OLDEST_NODE}`, `${(await run(oldNode, ['--version'])).stdout.trim()}, exit ${rerun.code}, output saved as ${outName}`);
}
