# Contributing

Thanks for your interest! Bug reports, issues and pull requests are welcome.

## Getting started

Follow the "Local development" section in [README.md](README.md). A plain
`composer install && npm install` is enough to work on the code and run the
Unit and Feature tests; extracting the game data (`npm run refresh:data`) is
only needed for the Contract suite and for actually browsing the app.

## Quality gate

`composer install` configures `core.hooksPath` to the tracked `.githooks`
directory, so every commit runs `composer review`: eslint, prettier, tsc,
vitest, rector, pint, phpstan and the Unit + Feature suites. You can run it
manually any time. Pull requests run the same checks in CI.

## Pull requests

- Every change should come with a test (new or updated). See "Running tests"
  in the README for which suite needs what.
- Keep the diff focused; unrelated cleanups belong in their own PR.
- Follow the existing code conventions; when in doubt, look at sibling files.
- Never commit GGG assets or game data: no icons, art, passive tree JSON or
  other extracted files. They are Grinding Gear Games' property and are
  regenerated locally from the patch CDN (the paths are gitignored, so this
  mostly means: do not force-add anything under `public/icons`, `public/tree`
  or `resources/poe2/ggpk`). A PR containing game data or art will be rejected.

## Game data policy (important)

All Path of Exile 2 data in this project - passive tree, items, gems, stat
descriptions, icons - is extracted from the official game files (GGPK / patch
CDN) via `tools/poe-data-extract`. That is the single source of truth.

Please do not add data from third-party sites, community exports or vendored
JSON dumps. If the GGPK route does not cover something yet, the fix is to
extend the extractor, not to fetch the data from elsewhere. See
[`resources/poe2/ATTRIBUTION.md`](resources/poe2/ATTRIBUTION.md) for the full
source breakdown.
