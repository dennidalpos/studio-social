# Changelog

## Unreleased

### Added
- Interface language: Italian and English, with an IT/EN selector (first visit follows the browser language). Generated posts follow the language chosen for the plan or draft.
- `npm run browser`: optional separate Electron window with a persistent profile in `.data/browser`, a Socials menu, https-only navigation and denied permission prompts. The sign-in stays the person's own action.
- Simple view (default): write a post, see the preview with the per-social character count, then copy it and open the social in the user's own logged-in browser (LinkedIn opens with the text prefilled). No accounts, keys or scheduling. The draft and the choice are remembered in the browser; a button switches to the advanced view (plan, scheduling, API publishing, accounts).
- Sticky top bar with the current section marked, back-to-top button, and page notices that stay visible under the bar.
- `run.ps1`: installs and starts the app, with an arrow-key menu to start in demo or real mode, stop running instances or pick another port.

- MIT `LICENSE`, `CREDITS.md` (fonts and dev tooling with their licenses), `license` field in `package.json`.
- README rewritten in English with real screenshots (`docs/images/`), Mermaid diagrams, `run.ps1` documentation, tests and limits.

### Changed
- "Modalità prova" is now "Demo · invii simulati" (and "Reale · pubblica davvero"); the mode pill links to the setting. The plan's publishing option is called "Pubblicazione" and the environment setting "Ambiente".
- Account guides and AI providers open one at a time.
- Session cookie is named per port (`studio_session_<port>`).

## 0.5.0

### Security
- Login key: the API, the page and the media need an HttpOnly session cookie. The key lives in `.data/access.key` and is printed as a login URL at startup. Only the LinkedIn OAuth callback is exempt (it has its own `state` check).
- `.data/` is restricted to the current user (and SYSTEM on Windows) in one step, without a moment of inherited access.
- `ffprobe` and `openssl` are resolved from absolute `PATH` entries, so a file planted in the working directory is never run.

### Added
- Playwright end-to-end suite (`npm run test:e2e`) and a GitHub Actions workflow that runs it.
- Favicon.
- Hourly cleanup of media no post or plan uses (older than 24 hours).
- "Elenca modelli" button next to every model field in the provider settings: it asks the provider which models the key can use and fills the field from a list. Unit tests (`npm test`) cover the model listing.

### Changed
- Interface: borders of inputs and buttons now reach 3:1 contrast; the section menu stays visible on phones and touch layouts use 44px targets; DM Sans and Instrument Serif are bundled in `public/fonts/` (SIL OFL, licences included); colours are tokens and the page follows the system dark scheme.

### Fixed
- Claude generations no longer fail when thinking tokens use up `max_tokens` (low effort, 6000 tokens).
