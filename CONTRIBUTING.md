# Contributing

Studio Social is a small, zero-dependency Node.js 24+ app (plain ES modules, `node:sqlite`). Keep it that way: do not add runtime dependencies.

## Set up

```sh
npm install        # test tooling only
npm start          # demo mode on http://localhost:3000
```

## Before opening a pull request

```sh
npm test           # unit tests
npm run test:e2e   # Playwright tests (demo mode)
```

- Test with demo mode and synthetic data. Never commit keys, tokens, `.env`, `.data/` or real screenshots with personal data.
- Describe user-visible changes in `CHANGELOG.md` under "Unreleased".
- New third-party components, fonts or assets need their license listed in `CREDITS.md`.
- Publishing with a personal login stays assisted (copy and open); do not add automation or embedding for it.

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
