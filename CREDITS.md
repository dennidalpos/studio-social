# Credits

Third-party components, checked against their own package metadata and license files on 2026-11-17 (Studio Social 0.5.0 and later). This is a technical check, not legal advice.

Studio Social itself is released under the [MIT License](LICENSE).

## Shipped with the app

The app has no runtime dependencies: `package.json` declares none and `package-lock.json` lists only the development tools below. It runs on Node.js 24+ built-ins (`node:sqlite` and others).

| Component | Where | License | Source | Obligation |
| --- | --- | --- | --- | --- |
| DM Sans (latin, variable) | `public/fonts/dm-sans-latin-wght-normal.woff2` | SIL OFL 1.1 | <https://github.com/googlefonts/dm-fonts> | Keep the copyright notice and license text with the font: [LICENSE-DM-Sans.txt](public/fonts/LICENSE-DM-Sans.txt). The font is not modified and not sold on its own. |
| Instrument Serif (latin, regular) | `public/fonts/instrument-serif-latin-400-normal.woff2` | SIL OFL 1.1 | <https://github.com/Instrument/instrument-serif> | Same: [LICENSE-Instrument-Serif.txt](public/fonts/LICENSE-Instrument-Serif.txt). |

## Development only (not shipped)

| Package | Version | License | Source |
| --- | --- | --- | --- |
| `@playwright/test` | 1.65.1 | Apache-2.0 | <https://github.com/microsoft/playwright> |
| `playwright` | 1.65.1 | Apache-2.0 | <https://github.com/microsoft/playwright> |
| `playwright-core` | 1.65.1 | Apache-2.0 | <https://github.com/microsoft/playwright> |

These are installed only with `npm install` (tests); `run.ps1` skips them unless `-WithDevTools` is given.

## External tools and services (not bundled)

- [FFmpeg](https://ffmpeg.org/) (`ffprobe`) and OpenSSL are called when present on the machine; they are not distributed with Studio Social.
- Provider APIs (OpenAI, Anthropic, QwenCloud, Gemini, LinkedIn, Facebook, Instagram) are used only with the user's own keys and are subject to their own terms.

## Findings

- No copyleft or unknown licenses among shipped components.
- OFL 1.1 fonts are compatible with an MIT project; the OFL text stays with the font files.
- Not verified: license text of the font files against the upstream repositories beyond the copy shipped in `public/fonts/`.
