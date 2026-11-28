# Security policy

## Supported versions

Only the latest release on `master` is supported.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on <https://github.com/dennidalpos/studio-social>.

Include the version, the steps to reproduce and the impact. Never include real API keys, tokens or the contents of `.data/` or `.env`.

## Scope and design notes

- The app is a local tool for one person: it listens on the local machine only and is protected by an access key (`.data/access.key`) and an HttpOnly session cookie.
- `.data/` and `.env` hold credentials and private data. They are ignored by Git and must stay out of shared archives and public backups.
- Keys and tokens are never shown in the browser after saving.
