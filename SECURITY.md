# Security policy

## Reporting a vulnerability

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Please do not open a public issue for a security problem.

A confirmed problem is fixed in a new release, and the advisory is published once the fix is on npm.

## Supported versions

Only the latest major version (2.x) gets security fixes.

## What this package is not

It rewrites files in place: the file you name, or every `.json` file under the directory you name. Run it only on files you own and have committed or backed up. It does not follow symbolic links when it walks a directory, makes no network requests, and runs no code from the files it reads. It is not a validator or a linter, and it does not read JSON5 or JSON with comments; such files are reported and left alone.
