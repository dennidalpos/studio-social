# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person managing their own social presence: freelancers, small studios and professionals. Two situations: a personal login only (no API access) or a business profile / Page with API access. Used on a laptop and, for the simple view, on a phone.

## Product Purpose

Studio Social turns a brief into editable social posts and helps publish them. The simple view (default) writes, previews and copies the text, then opens the social in the user's own browser so they press Publish themselves; in it the AI can write the post from a short request, with an optional web search. The advanced view adds an editorial plan, scheduling and API publishing for LinkedIn, Facebook and Instagram, and export for TikTok. Success: a post is ready and published in a few minutes, with no surprise sends.

## Operating Context

- Runs locally, started from the terminal; the person opens the printed login link. Data, keys and attachments stay in the local, Git-ignored `.data` folder.
- Two modes, always visibly distinct: **Prova** (nothing is published, AI text is a sample) and **Pubblicazione** (posts go out on the connected accounts). The choice is made from the pill in the top bar of the advanced view.
- Two views, chosen from the top bar: **Semplice** (default, no account, key or setup) and **Avanzata**.
- Advanced sections: Piano, Post, **Collegamenti** (social accounts) and **Impostazioni AI** (service, key, model, wait time). The same AI settings open from the simple view.
- Long AI calls show elapsed time and can be cancelled.

## Capabilities and Constraints

- The Italian UI is the source; English is a translation layer in the browser (selector in the top bar). Docs are English.
- The optional separate browser window only keeps the user's own cookies in a local, Git-ignored profile; the app never sees or fills credentials.
- TikTok works by export only: Direct Post is reserved by TikTok to apps for a wide audience.
- Real accounts and real AI services need the user's own keys; only demo mode and mocks are verified without them.

### Glossary (UI and messages)

Use one word per idea, in Italian first:

| Use | Not | Meaning |
| --- | --- | --- |
| servizio AI | provider, modello AI | The AI company or API that writes the text (OpenAI, Claude, QwenCloud, Gemini, compatible). |
| chiave | token, API key (in prose) | The secret the user pastes for a service. "Token" only where the social itself calls it so (Pagina, Instagram). |
| indirizzo | URL, endpoint | A web address, e.g. the base address of a compatible service. |
| allegato | media, file | The photo or video attached to a post. |
| collegamento / Collega | account (as a section) | A connection to a social profile. |
| Prova / Pubblicazione | demo, live | The two modes. |
| Semplice / Avanzata | simple, advanced | The two views. |

Messages say what happened and what to do next. Never only "non valido" or "non riuscita", never a bare HTTP code without the fix, and always translated (also the session-expired message).

## Brand Commitments

Calm, editorial, trustworthy voice. Plain language, no hype. Name: Studio Social.

## Evidence on Hand

No customer, testimonial or benchmark data exists. Do not invent any.

## Product Principles

1. Simple first: the default view needs no account, key or setup.
2. The user stays in control: publishing with personal logins is always their own action, and destructive or replacing actions ask first and say how much they affect.
3. Honest state: Prova and Pubblicazione are always visibly distinct.
4. Dark patterns are out: no push toward automatic posting, no automation or reading of personal logins.
5. Phone-ready: 44px targets, no horizontal scroll at 375px.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Respect `prefers-color-scheme` and reduced motion. The UI is available in Italian and English. Strong contrast in light and dark, visible focus, clear labels.
