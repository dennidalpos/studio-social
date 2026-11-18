# Changelog

## Unreleased

### Added
- AI requests with a `github.com/owner/repo` link: the server reads the repository description, topics and README (fixed host, no redirects) and gives the text to the model, because the provider's own web search often does not read the page. Other links still rely on the provider's web search.
- The simple view turns **Abilita web** on when the request has an https link, or says the AI service cannot read web pages.
- AI wait: a progress row with elapsed seconds and **Annulla** while the AI writes (simple request, **Genera una bozza**, **Migliora i campi con l’AI**). Cancelling aborts the request (the server stops the AI call and saves nothing) and leaves the fields as they were; after 30 s a hint points to the wait-time setting.
- In-page confirmation dialog for deleting posts, **Svuota i post di prova** (it names how many posts go), **Svuota** in the simple view (text and/or attachment) and replacing text with the AI's. **Annulla le modifiche dell’AI** restores the previous values after **Migliora i campi con l’AI**.
- Glossary of UI terms (servizio AI, chiave, indirizzo, allegato) in `PRODUCT.md`.
- Set up the AI from the simple view: **Configura l’AI** opens a dialog to choose the AI service, save its key and model (with the model list and the wait time) without going to the advanced view. A line under the AI button shows the service in use and whether it is ready; **Scrivi con l’AI** opens the dialog instead of failing when the service is not set up.
- Interface language: Italian and English, with an IT/EN selector (first visit follows the browser language). Generated posts follow the language chosen for the plan or draft.
- `npm run browser`: optional separate Electron window with a persistent profile in `.data/browser`, a Socials menu, https-only navigation and denied permission prompts. The sign-in stays the person's own action.
- Simple view (default): write a post, see the preview with the per-social character count, then copy it and open the social in the user's own logged-in browser (LinkedIn opens with the text prefilled). No accounts, keys or scheduling. The draft and the choice are remembered in the browser; a button switches to the advanced view (plan, scheduling, API publishing, accounts).
- AI in the simple view: write a request, press **Scrivi con l’AI** and the post is written for the chosen social within its character limit (uses the plan's AI provider; nothing is saved or published).
- AI in the advanced view: **Migliora i campi con l’AI** turns generic words in Temi, Pubblico, Tono and Materiale into complete texts you can check before saving the plan. Links you typed are kept.
- **Abilita web** toggle (simple request and plan): the AI reads the links you enter and can search for sources, using the provider's own web search (OpenAI, Claude, QwenCloud). Providers without it keep the toggle off. The plan stores the choice.
- `AI_TIMEOUT_MINUTES` (also in Account → Configura i provider AI): how long to wait for slow models. Failed AI calls now log the real cause (provider, host, error code) without keys.
- Sticky top bar with the current section marked, back-to-top button, and page notices that stay visible under the bar.
- `run.ps1`: installs and starts the app, with an arrow-key menu to start in demo or real mode, stop running instances or pick another port.

- MIT `LICENSE`, `CREDITS.md` (fonts and dev tooling with their licenses), `license` field in `package.json`.
- README rewritten in English with real screenshots (`docs/images/`), Mermaid diagrams, `run.ps1` documentation, tests and limits.

- Media in the simple view: **Foto o video** with preview in the post, **Copia immagine** (to paste into the social's composer with Ctrl+V) and a download link; videos are uploaded on the social from the downloaded file. The file is checked for the chosen social and dropped if you switch to one that does not accept it. Nothing is sent to any social.
- Delete posts: **Elimina** on every card and in the editor (with a confirmation that says what happens; for published posts only the local copy goes, the post stays on the social), and **Svuota i post di prova** in demo mode. A deleted post of the recurring plan does not come back the same day.

### Fixed
- The **Avanzata** button was clipped off the right edge of the header; the view buttons no longer shrink. Pressing the view already shown scrolls to the top.
- Smaller page title and headings; Instrument Serif headings use the weight that is actually loaded (400) instead of a synthetic bold.
- **Pubblica ora** and the automatic plan now ask with the in-page dialog instead of the browser's confirm.
- The **Abilita web** checkboxes were disabled for an OpenAI-compatible service hosted by QwenCloud/DashScope. They are now available for those hosts (sent as `enable_search`), and the simple view says why the toggle is off when the plan's provider has no web search.
- The top bar marked both Piano and Post when they sit side by side; now only one place is marked (the one chosen from the menu, otherwise Piano).

### Changed
- Simple view: **Copia e apri** is the only solid button; **Scrivi con l’AI** is secondary and **Abilita web** sits under the AI field.
- The Account section is split into **Collegamenti** (social accounts) and **Impostazioni AI** (service, key, model, wait time; same dialog as the simple view). The Prova / Pubblicazione choice moved to a dialog opened from the mode pill. The menu is Piano · Post · Collegamenti · Impostazioni AI.
- Errors and system texts say what happened and what to do (no bare "non valido", "non riuscita" or "errore 401"); "Session expired." is translated; "provider", "URL" and "endpoint" became "servizio AI" and "indirizzo".
- Phone layout at 375 px: wider language select, 2x2 channel grid, smaller title without a forced break, page notice no longer sticky, no back-to-top button (the brand link goes to the top), and a **Semplice | Avanzata** segmented view control (the brand name hides below 480 px).
- `PRODUCT.md` follows the current Impeccable schema (no Register section) and reflects the mode names and the simple-view AI.
- Plain names for the two modes, in Italian and English: **Prova** / Practice (nothing is published) and **Pubblicazione** / Publishing (real accounts). The top-bar badge reads "Prova · non pubblica nulla" or "Pubblicazione attiva"; the setting is "Come vuoi usare Studio Social?" with "Salva scelta". "Ambiente", "Modalità demo/reale" and "pubblica davvero" are gone; "modalità" now only means the simple/advanced view.
- Dark theme: neutral warm charcoal surfaces with green kept for buttons, links and accents (button text colour and hover are now tokens).
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
