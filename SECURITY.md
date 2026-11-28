# Security Policy

## Supported versions

Only the latest commit on the `master` branch is supported.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Use GitHub's private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. Include the version, the steps to reproduce and the impact you observed. Never include real API keys, tokens or the contents of `.data/` or `.env`.

You can expect an acknowledgement within a few days. Confirmed issues are fixed on `master` and disclosed after a fix is available.

## Scope notes

- The app is a local tool for one person: it listens on the local machine only and is protected by an access key (`.data/access.key`) and an HttpOnly session cookie.
- `.data/` and `.env` hold credentials and private data. They are ignored by Git and must stay out of shared archives and public backups.
- Keys and tokens are never shown in the browser after saving.
