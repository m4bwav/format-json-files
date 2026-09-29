#!/bin/sh
# The Linux run of 2026-09-29-wiki-verify.mjs, in WSL (Ubuntu), from the same scratch folder as the Windows run.
# Node 24.18.0 and 20.20.2 come from the npm registry's node-linux-x64 packages and npm 11.16.0 from its npm package
# (`npm pack node-linux-x64@24.18.0 node-linux-x64@20.20.2 npm@11.16.0` on Windows into $R/linux, each node package
# unpacked there as node-<version>/package, and two shims in $R/linux/shims running npm-cli.js and npx-cli.js), so
# nothing is downloaded from anywhere but the registry. PATH holds only those and /usr/bin:/bin, so WSL interop's
# Windows node and npm are never picked up (wikiwright L-132).
# Run: wsl -e env R=/mnt/c/<scratch folder> CLONE=/mnt/d/<the clone> sh linux-run.sh > wiki-verify.linux.out.txt
# $R holds verify/ (wiki-verify.mjs, file-tree.mjs, node_modules), old106/ and linux/. The run on 2026-09-29 had these
# two paths written in; they are variables here so no local path is kept in the repository.
set -e
: "${R:?set R to the scratch folder}" "${CLONE:?set CLONE to the repository clone}"
L=$R/linux
if [ ! -d "$L/npm-11/package" ]; then
  mkdir -p "$L/npm-11"
  tar -xzf "$L/npm-11.16.0.tgz" -C "$L/npm-11"
fi
cd "$R/verify"
exec env -i HOME="$HOME" LANG=C.UTF-8 \
  PATH="$L/node-24.18.0/package/bin:$L/shims:/usr/bin:/bin" \
  npm_config_cache="$L/npm-cache" \
  GOLDEN="$CLONE/test/golden" \
  OLD="$R/old106" \
  OLDEST_NODE=20 OLDEST_NODE_BIN="$L/node-20.20.2/package/bin/node" \
  node wiki-verify.mjs
