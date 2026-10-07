# Security policy

## Reporting a problem

Open an issue or a pull request and I'll take a look. You can also report privately: open the repository's **Security** tab and choose **Report a vulnerability**.

A confirmed problem is fixed in a new release, and the advisory is published once the fix is on npm.

## Supported versions

Only the latest major version (2.x) gets security fixes.

## What this package is not

It rewrites files in place: the file you name, or every `.json` file under the directory you name. Run it only on files you own and have committed or backed up. It does not write through symbolic links when it walks a directory (a hard link is the file itself and is rewritten in place), makes no network requests, and runs no code from the files it reads. It is not a validator or a linter, and it does not read JSON5 or JSON with comments; such files are reported and left alone.
