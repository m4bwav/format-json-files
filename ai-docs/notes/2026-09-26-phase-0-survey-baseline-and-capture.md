---
title: "Phase 0 survey: registry, repository, baseline, capture and security of 1.0.6"
kind: note
status: active
date: 2026-09-26
verified: 2026-09-26
stale_after: 2027-03-26
tags: [survey, baseline, v2, dead-services, tarball, golden, cli, filesystem, security]
aliases: [survey, baseline, cli.js, meow, webhooks, capture, data loss, fixture trees]
summary: "read before the plan or the cleanup: what 1.0.6 is and ships, the old suite's result on Node 24, what the golden capture found (silent data loss on big integers, duplicate keys, -0, 1e400 and non-UTF-8 bytes; integer-like keys reordered; every file rewritten; BOM files skipped), the one dependent and its file format, the dead services with their webhook id, and the raw survey-npm.sh and image-check output"
---

# Phase 0 survey: format-json-files 1.0.6

## Summary

Surveyed 2026-09-26 with the package-modernize skill's scripts/survey-npm.sh (raw output at the end), Node 24.18.0 and npm 11.16.0 on Windows. Nothing in the package changed during Phase 0. The golden capture of the published 1.0.6 is `test/golden/1.0.6.json`, recorded by `test/golden/capture-1.0.6.cjs` over the trees in `test/golden/capture-fixtures.cjs` (47 cases, 59 KB; two runs byte-identical).

## Registry and repository

- npm: latest 1.0.6, all seven versions published 2018-12-24; 31 downloads 2026-08-27 to 2026-09-25 (a 90 peak in 2026-06); registry counts 0 dependents. One registry signature, no attestations. Maintainer markrogers.
- The tarball (3181 bytes, 5 files: LICENSE, README.md, cli.js, index.js, package.json; a `files` allowlist) equals master file for file (`diff --strip-trailing-cr`), packed from Windows with CRLF in every text file.
- Code: `index.js` (CommonJS `module.exports = function (pathArgument)`, synchronous, returns undefined), `cli.js` (meow ^5, resolves 5.0.0; shebang; `bin: "cli.js"`), `test.js` (ava 1, five tests). No `engines`, no `exports`, no build.
- Runtime dependency: meow ^5 (latest 14.1.0). Dev: ava 1, nyc 13, xo 0.23, snyk, coveralls, del 3.
- GitHub: issue #1 (bertyhell, 2019-12-06, "sorting keys would be a useful option"), open. No pull requests, forks, tags, releases or other branches.
- Security settings: 103 open Dependabot alerts (100 development, 3 runtime through meow 5: yargs-parser, trim-newlines, semver); Dependabot security updates off; webhook 72197148 (Travis, active, dead service); secret scanning and push protection off; default workflow permissions write with pull request approval allowed; no rulesets, workflows, secrets, variables or environments.
- Dead-service files: `.travis.yml`, `.snyk` (an empty policy). README images: 6 of 7 to fix (nodei.co, Travis, David, Coveralls, Snyk, Gitter; the XO badge answers). The published README equals the repository's.
- Leaked credentials: none. Every version's `scripts` is `snyk test && xo && nyc ava` plus coveralls lines, no token; `git log -p --all` finds only lockfile names containing "token".

## Dependent

cdlib/cdlib-ui (pushed 2026-09-10) has `"format-json-files": "^1.0.6"` and the script `"format-sample-data": "format-json-files sample-data"`, run in its package root. Its sample-data (home.json, categories.json checked) is exactly 1.0.6's output: LF, 4-space indent, no final newline, and `JSON.stringify(JSON.parse(text), null, 4) === text`. So a 2.x default that changes the indent, adds a final newline or reorders keys would rewrite every one of their files on the next run; 2.x must write nothing for them.

## Baseline (the old suite on Node 24.18)

In a scratch clone: `npm install` added 801 packages with deprecation warnings; `npm test` stops at `snyk test` ("requires an authenticated account"); `xo` 0.23 crashes (`TypeError: util.isDate is not a function`); `ava` 1 passes its 5 tests; `nyc ava` reports 0 percent (nyc 13 does not instrument it). The old tests only pass in their catch blocks or compare one file; the golden capture is the real baseline.

## What the golden capture found (claims checked)

Confirmed from the kickoff: formats a file path whatever its extension; walks directories with lstat, picks names ending `.json` case-insensitively (`.JSON`, `.Json`, and a file named just `.json`), descends into node_modules, `.git` and hidden directories, recurses into a directory named `dir.json`; `JSON.stringify(obj, null, 4)`, no final newline, CRLF and tabs and 2-space all become LF 4-space; parse failures are logged on stdout ("Error processing target file: ..., skipping." plus "Original Error: ...") and the call returns undefined, exit 0 from the CLI; a falsy argument throws `Error: Path argument not set`, a non-string `TypeError: Target path argument is not a string` (a `String` object included), a missing path `Error: Invalid path`; `--help` prints meow's help, no argument exits 1 with the stack trace. Silent data loss: 12345678901234567890 becomes 12345678901234567000, duplicate keys keep the last, -0 becomes 0, 1e400 and -1e400 become null. A UTF-8 BOM file is skipped.

Found beyond the kickoff:
- Invalid UTF-8 bytes (a Latin-1 `é`) are read as U+FFFD and the file is rewritten with the replacement character: silent data loss.
- Integer-like keys move to the front (`{"b":1,"a":2,"10":3,"2":4}` becomes `"2"`, `"10"`, `"b"`, `"a"`): JavaScript object key order.
- `0.1000000000000000055511151231257827` is written as `0.1`, `1.0` as `1`, `1e5` as `100000`, `"a\/b"` as `"a/b"`, `"é"` as `é`, escaped surrogate pairs as the emoji; a lone surrogate stays escaped.
- UTF-16 files fail to parse and are skipped.
- A 10000-deep array parses but `JSON.stringify` overflows the stack; the error is caught and logged, the file untouched. A 40-deep one is written.
- A read-only file is logged (EPERM) and skipped; the others are still written.
- Every matched file is rewritten even when the bytes do not change (`dir-twice`: all 29 files written again).
- Directory junctions are skipped by the walk; a path given through a junction is followed and written; a junction given as the argument throws `Invalid path` (lstat says neither file nor directory). File symbolic links could not be created on this machine (EPERM without developer mode), so the file-link behaviour is not recorded.
- CLI: `--sort-keys .` makes meow read `.` as the flag's value, so the path is lost and the call throws; `-h` is not an alias of `--help` in meow 5 and also throws; a second path is ignored.
- Not reachable: `readJsonFileToObject` swallows a non-SyntaxError from JSON.parse and returns undefined, but JSON.parse of a Buffer throws nothing else in practice.

## Raw survey output

The survey-npm.sh output of 2026-09-26 follows unchanged.

```text
# npm survey: format-json-files (2026-09-26T22:03Z)

## Registry metadata
$ npm view format-json-files name version dist-tags time.created time.modified license author repository.url homepage main module types exports bin engines dependencies peerDependencies deprecated
name = 'format-json-files'
version = '1.0.6'
dist-tags = { latest: '1.0.6' }
time.created = '2018-12-24T02:57:22.468Z'
time.modified = '2022-05-02T19:29:47.160Z'
license = 'MIT'
author = 'Mark Rogers (http://www.markdavidrogers.com/)'
repository.url = 'git+https://github.com/m4bwav/format-json-files.git'
homepage = 'https://github.com/m4bwav/format-json-files'
main = './index.js'
bin = { 'format-json-files': 'cli.js' }
dependencies = { meow: '^5.0.0' }

## All published versions with dates
$ npm view format-json-files time --json
{
  "created": "2018-12-24T02:57:22.468Z",
  "1.0.0": "2018-12-24T02:57:22.568Z",
  "modified": "2022-05-02T19:29:47.160Z",
  "1.0.1": "2018-12-24T03:21:55.384Z",
  "1.0.2": "2018-12-24T03:32:33.050Z",
  "1.0.3": "2018-12-24T03:36:15.360Z",
  "1.0.4": "2018-12-24T16:30:11.382Z",
  "1.0.5": "2018-12-24T17:07:25.346Z",
  "1.0.6": "2018-12-24T17:21:33.718Z"
}

## Attestations and signatures on the latest version
$ npm view format-json-files dist.attestations dist.signatures --json
[
  {
    "keyid": "SHA256:jl3bwswu80PjjokCgh0o2w5c2U4LhQAE57gj9cz1kzA",
    "sig": "MEUCIA3SDDJZXrhExSaesNCgM0BomnsyysyziV/AU87CxbIwAiEAi+1XBlySbSHqBnsg4ORYR20W3O0yoqLn6e3Dp1IBs1I="
  }
]

## Maintainers (emails masked)
$ npm view format-json-files maintainers --json | sed -E 's/ <[^>]*>/ <email>/'
[
  "markrogers <email>"
]

## Downloads, last month
$ curl -s https://api.npmjs.org/downloads/point/last-month/format-json-files
{"downloads":31,"start":"2026-08-27","end":"2026-09-25","package":"format-json-files"}
## Downloads, last year by month
$ curl -s "https://api.npmjs.org/downloads/range/last-year/format-json-files" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m={};for(const {day,downloads} of JSON.parse(s).downloads){const k=day.slice(0,7);m[k]=(m[k]||0)+downloads}console.log(m)})'
{
  '2025-09': 5,
  '2025-10': 23,
  '2025-11': 21,
  '2025-12': 48,
  '2026-01': 25,
  '2026-02': 25,
  '2026-03': 32,
  '2026-04': 35,
  '2026-05': 41,
  '2026-06': 90,
  '2026-07': 60,
  '2026-08': 54,
  '2026-09': 25
}

## Dependents (registry search; npmjs.com shows the list)
$ curl -s "https://registry.npmjs.org/-/v1/search?text=format-json-files&size=1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(JSON.stringify({total:r.total, first:r.objects[0]?.package?.name, dependents: r.objects[0]?.dependents ?? "(see https://www.npmjs.com/browse/depended/format-json-files)"}))})'
{"total":667091,"first":"format-json-files","dependents":0}

## Dependents by name: public repositories whose package.json names it (the registry gives only a count)
$ gh search code "\"format-json-files\"" --filename package.json --json repository --jq '.[].repository.nameWithOwner' --limit 50 2>&1 | sort -u
cdlib/cdlib-ui

## Tarball file list of the published version
$ npm pack format-json-files --dry-run --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const [p]=JSON.parse(s);console.log(p.size+" bytes, "+p.entryCount+" files");for(const f of p.files)console.log(" "+f.path+" "+f.size)})'
3181 bytes, 5 files
 LICENSE 1089
 README.md 2391
 cli.js 347
 index.js 2924
 package.json 1413

## Runtime dependencies: how far behind
$ npm view <dep> version time.modified deprecated
meow: wanted ^5.0.0, latest 14.1.0 (modified 2026-02-20)

# GitHub side (m4bwav/format-json-files)
# GitHub survey: m4bwav/format-json-files (2026-09-26T22:03Z)

## Repository
$ gh repo view m4bwav/format-json-files --json name,description,defaultBranchRef,pushedAt,createdAt,licenseInfo,stargazerCount,forkCount,isArchived,homepageUrl --jq '{name,description,defaultBranch:.defaultBranchRef.name,pushedAt,createdAt,license:.licenseInfo.key,stars:.stargazerCount,forks:.forkCount,archived:.isArchived,homepage:.homepageUrl}'
{"archived":false,"createdAt":"2018-12-22T01:04:05Z","defaultBranch":"master","description":"Formats json files in the given path.  Files have to have the .json extension.","forks":0,"homepage":"","license":"mit","name":"format-json-files","pushedAt":"2018-12-24T17:21:07Z","stars":0}

## Settings and security features
$ gh api repos/m4bwav/format-json-files --jq '{delete_branch_on_merge, has_wiki, has_projects, allow_squash_merge, web_commit_signoff_required, security_and_analysis}'
{"allow_squash_merge":true,"delete_branch_on_merge":false,"has_projects":true,"has_wiki":true,"security_and_analysis":{"dependabot_security_updates":{"status":"disabled"},"secret_scanning":{"status":"disabled"},"secret_scanning_non_provider_patterns":{"status":"disabled"},"secret_scanning_push_protection":{"status":"disabled"},"secret_scanning_validity_checks":{"status":"disabled"}},"web_commit_signoff_required":false}

## Default workflow permissions
$ gh api repos/m4bwav/format-json-files/actions/permissions/workflow
{"default_workflow_permissions":"write","can_approve_pull_request_reviews":true}
## Branches
$ gh api repos/m4bwav/format-json-files/branches --paginate --jq '.[].name'
master

## Rulesets and branch protection
$ gh api repos/m4bwav/format-json-files/rulesets --jq '.[] | "\(.id) \(.name) \(.enforcement)"'; gh api repos/m4bwav/format-json-files/branches/$(gh repo view m4bwav/format-json-files --json defaultBranchRef --jq .defaultBranchRef.name)/protection --jq . 2>/dev/null || echo '(no classic branch protection)'
{"message":"Branch not protected","documentation_url":"https://docs.github.com/rest/branches/branch-protection#get-branch-protection","status":"404"}(no classic branch protection)

## Issues (all states)
$ gh issue list -R m4bwav/format-json-files --state all --limit 100 --json number,title,state,author,createdAt,closedAt --jq '.[] | "#\(.number) \(.state) \(.createdAt[:10]) \(.author.login): \(.title)"'
#1 OPEN 2019-12-06 bertyhell: sorting keys would be a useful option

## Pull requests (all states)
$ gh pr list -R m4bwav/format-json-files --state all --limit 100 --json number,title,state,author,headRefName,createdAt --jq '.[] | "#\(.number) \(.state) \(.createdAt[:10]) \(.author.login) [\(.headRefName)]: \(.title)"'

## Open Dependabot alerts by severity, package and scope
$ gh api "repos/m4bwav/format-json-files/dependabot/alerts?state=open&per_page=100" --paginate --jq '.[] | "\(.security_advisory.severity) \(.dependency.package.name) \(.dependency.scope)"' | sort | uniq -c | sort -rn
     10 high tar development
      8 high handlebars development
      4 high js-yaml development
      3 high lodash development
      3 critical handlebars development
      2 medium tar development
      2 medium minimist development
      2 medium lodash development
      2 medium jszip development
      2 medium js-yaml development
      2 high snyk development
      2 high ansi-regex development
      2 critical minimist development
      1 medium yargs-parser runtime
      1 medium xml2js development
      1 medium uuid development
      1 medium undefsafe development
      1 medium tough-cookie development
      1 medium snyk-sbt-plugin development
      1 medium snyk-python-plugin development
      1 medium snyk-mvn-plugin development
      1 medium snyk-gradle-plugin development
      1 medium snyk-docker-plugin development
      1 medium snyk development
      1 medium request development
      1 medium qs development
      1 medium netmask development
      1 medium https-proxy-agent development
      1 medium handlebars development
      1 medium got development
      1 medium decode-uri-component development
      1 medium ajv development
      1 low tmp development
      1 low snyk development
      1 low ip development
      1 low handlebars development
      1 low chownr development
      1 low (babel scope) core development
      1 high y18n development
      1 high trim-newlines runtime
      1 high toml development
      1 high tmp development
      1 high snyk-php-plugin development
      1 high snyk-gradle-plugin development
      1 high snyk-go-plugin development
      1 high set-value development
      1 high semver runtime
      1 high qs development
      1 high pac-resolver development
      1 high nconf development
      1 high minimatch development
      1 high lodash.set development
      1 high lodash.mergewith development
      1 high lodash.merge development
      1 high json5 development
      1 high ip development
      1 high ini development
      1 high form-data development
      1 high dot-prop development
      1 high degenerator development
      1 high decode-uri-component development
      1 high braces development
      1 high brace-expansion development
      1 critical set-value development
      1 critical netmask development
      1 critical mixin-deep development
      1 critical lodash development
      1 critical json-schema development
      1 critical fsevents development
      1 critical form-data development
      1 critical eslint-utils development
      1 critical (babel scope) traverse development

## Open Dependabot alerts, count
$ gh api "repos/m4bwav/format-json-files/dependabot/alerts?state=open&per_page=100" --paginate --jq length
100
3

## Webhooks (dead services leave these)
$ gh api repos/m4bwav/format-json-files/hooks --jq '.[] | "\(.id) \(.config.url) active=\(.active) events=\(.events|join(","))"'
72197148 https://notify.travis-ci.org active=true events=create,delete,issue_comment,member,public,pull_request,push,repository

## Actions secrets (count) and variables
$ gh api repos/m4bwav/format-json-files/actions/secrets --jq '{total_count, names:[.secrets[].name]}'; gh api repos/m4bwav/format-json-files/actions/variables --jq '{total_count, names:[.variables[].name]}'
{"names":[],"total_count":0}
{"names":[],"total_count":0}

## Environments
$ gh api repos/m4bwav/format-json-files/environments --jq '.environments[]? | "\(.name) reviewers=\([.protection_rules[]? | select(.type=="required_reviewers") | .reviewers[]?.reviewer.login] | join(","))"'

## Workflows
$ gh api repos/m4bwav/format-json-files/actions/workflows --jq '.workflows[] | "\(.name) \(.path) \(.state)"'

## Action pins in the default branch's workflows, with each action's runtime
$ action_pins (git tree, contents API, action.yml at each ref)
(no workflow files)

## Forks
$ gh api repos/m4bwav/format-json-files/forks --jq '.[] | "\(.full_name) pushed=\(.pushed_at[:10])"'

## Releases and tags
$ gh release list -R m4bwav/format-json-files --limit 20; gh api repos/m4bwav/format-json-files/tags --jq '.[].name' | head -30

## Dead-service files in the default branch
$ gh api repos/m4bwav/format-json-files/git/trees/HEAD?recursive=1 --jq '.tree[].path' | grep -Ei '^(\.travis\.yml|\.snyk|\.synk|\.sonarcloud\.properties|sonar-project\.properties|\.coveralls\.yml|codecov\.yml|\.codecov\.yml|appveyor\.yml|\.circleci/|\.npmignore|\.nuspec|\.vscode/)' || echo '(none)'
.snyk
.travis.yml

## Dotfiles at the root of the default branch
$ gh api repos/m4bwav/format-json-files/contents --jq '.[].name' | grep '^\.' || echo '(none)'
.gitignore
.snyk
.travis.yml

## Branches with no open pull request (stale work or bot leftovers; each needs a disposition)
$ comm -23 <(gh api repos/m4bwav/format-json-files/branches --paginate --jq '.[].name' | sort) <( (gh pr list -R m4bwav/format-json-files --state open --limit 200 --json headRefName --jq '.[].headRefName'; gh repo view m4bwav/format-json-files --json defaultBranchRef --jq .defaultBranchRef.name) | sort) || echo '(none)'

## Badges in the README
$ gh api repos/m4bwav/format-json-files/readme --jq .content | base64 -d 2>/dev/null | grep -Eo 'https?://[^ )]*(shields\.io|travis-ci|david-dm|snyk\.io|coveralls|codecov|gitter|sonarcloud|nodei\.co|badgen|badge)[^ )]*' | sort -u || echo '(none)'
https://badges.gitter.im/m4bwav/format-json-files.svg
https://coveralls.io/github/m4bwav/format-json-files?branch=master
https://david-dm.org/m4bwav/format-json-files
https://gitter.im/m4bwav/format-json-files?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge
https://img.shields.io/badge/code_style-XO-5ed9c7.svg
https://img.shields.io/coveralls/m4bwav/format-json-files/master.svg
https://img.shields.io/david/m4bwav/format-json-files.svg
https://img.shields.io/travis/m4bwav/format-json-files/master.svg
https://nodei.co/npm/format-json-files.png?downloads=true&downloadRank=true&stars=true
https://nodei.co/npm/format-json-files/
https://snyk.io/test/npm/format-json-files
https://snyk.io/test/npm/format-json-files/badge.svg?style=flat-square
https://travis-ci.org/m4bwav/format-json-files

## Things only the maintainer can see
- Installed GitHub Apps and authorized OAuth apps: github.com/settings/installations and github.com/settings/applications (the API refuses the gh token).
- Whether a token in history is still live: revoke it at the provider regardless.

## Next: in the clone
- Read every source and test file, package.json, the build config, the README and every dotfile.
- Leaked credentials: .travis.yml, .npmrc, .env, workflows, and history (git log -S TOKEN_NAME).
- Run the old build and tests as they are (Windows: npm --script-shell "C:/Program Files/Git/bin/bash.exe" test for ./node_modules/.bin scripts).
- Then the golden capture from the PUBLISHED version in a scratch project (scripts/golden-capture-npm.template.cjs).
```

Related: see also [../plans/](../plans/)
