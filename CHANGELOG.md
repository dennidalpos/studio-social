# Changelog

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
