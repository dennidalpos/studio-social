# Studio Social

Local web app for one person to write, schedule and publish social posts.

## Purpose

Write posts from a brief, keep editable drafts, and publish to a LinkedIn profile, a Facebook Page or an Instagram professional account (TikTok posts are prepared for export). A **simple view** needs no account: it copies the text and opens the social in your own signed-in browser. An **advanced view** adds a recurring plan, scheduling and API publishing. The interface is in Italian and English.

## Requirements

- [Node.js](https://nodejs.org/) 24 or later; no runtime dependencies.
- Optional: FFmpeg (`ffprobe`) for media uploads, and API keys for the AI service and the socials you connect.

## First setup

```sh
npm start
```

On Windows, `run.ps1` checks Node, creates `.env` from `.env.example` and opens the browser. The first time in each browser, open the address with the key printed in the terminal (`http://localhost:3000/?key=…`): it sets a session cookie. The key is in `.data/access.key`.

The app starts in demo mode (**Prova**): no keys or accounts, sample texts and simulated sends. Switch to **Pubblicazione** only after connecting accounts in **Collegamenti**.

## Usage

1. Enter a theme and choose **Genera una bozza**, then **Modifica**.
2. Simple view: **Copia e apri**. Advanced view: **Programma** or **Pubblica ora**.
3. Keep `npm start` running for the calendar to publish; an uncertain send is never repeated automatically.

The server listens only on the local machine. `.data/` and `.env` hold credentials: keep them out of Git and backups. Providers, per-social limits and media rules are in [REFERENCE.md](REFERENCE.md).

## Build and test

```sh
npm test            # unit tests
npm run test:e2e    # Playwright tests in demo mode (needs npm install and FFmpeg)
```

Real providers and live mode have only been exercised with mocks and demo mode.

## Documentation and security

[Full reference](REFERENCE.md) · [Changelog](CHANGELOG.md) · [Security policy](SECURITY.md) · [License](LICENSE) (MIT; components in [CREDITS.md](CREDITS.md)).
