# PoE2 reference data & icons

Vendored, framework-agnostic game data used to resolve gem/item icons and metadata.

- `ggpk/gems.json`, `ggpk/items.json`, `ggpk/runes.json`, `ggpk/gem_requirements.json` -
  derived straight from the game's GGPK data via the `tools/poe-data-extract` pipeline
  (`pathofexile-dat` reads the PoE2 patch server; see that tool's config). Re-run after a
  patch. This replaced the earlier RePoE/poe2db sources entirely.
- Rune effect text is rendered from GGG stat ids via the game's own
  `data/statdescriptions/stat_descriptions.csd` (a UTF-16 text file in the GGPK, exported
  by the same pipeline). Per-level gem requirements apply the known
  `getGemStatRequirement` formula over GGG's `ActorLevel` curve - the formula is an
  algorithm (game mechanic), the inputs are GGG data.
- `public/tree/current/**` - the passive skill tree, built **straight from the GGPK** by the
  `tools/poe-data-extract/tree` pipeline (PSG graph + `PassiveSkills`/`Characters`/`Ascendancy`
  tables + UI sprites, decoded from the patch server). `data.json` (topology, classes,
  ascendancies, stats), the four renderer atlases (`skills`, `skills-disabled`, `frame`,
  `mastery-effect-active`) and the centre art (`assets/centre/*`: class + ascendancy portraits,
  hub ring). A handful of UI-texture sprites the patch CDN doesn't serve (only a full game
  install) fall back to the project's prior atlases - see `docs/GGPK_SOURCE_OF_TRUTH.md`.
- `public/icons/poe2/Art/**` - gem/item icons. Skill/gem icons come from the GGPK pipeline;
  item icons whose `art/2ditems/*` texture bundles the patch CDN doesn't serve still come from
  [poe2-build-planner](https://github.com/poe2-tools/poe2-build-planner) (MIT, extracted from
  Content.ggpk) until a full-install extraction replaces them.
- The passive tree renderer in `resources/js/components/passive-tree/` is a thin wrapper over
  the project's own `@poe2-toolkit/*` packages (independent rewrite, MIT © Vladislav Rajtmajer).

Landing and build-viewer background art (`resources/images/landing/*`,
`resources/images/classes/*`) are the author's own generated pieces, not GGG art.
The earlier press-kit backgrounds (ambient/class/PoE2 logo) were removed when the
public pages moved to their own visual identity.

All game *data* and gem/item icons are © Grinding Gear Games. Used here for a
free, non-commercial community tool. Equipment
base-item art is **not** vendored yet - those icons arrive either from a later scrape
or from the GGG OAuth API (each item carries a signed `icon` URL). The icon layer is
source-agnostic so any of those slot in unchanged.

## Licensing notes

- All reference data now comes straight from the game's own GGPK (via `pathofexile-dat`
  reading the official PoE2 patch server) - bare game *facts/strings* © Grinding Gear Games.
  The earlier poe2db dependency (and its CC BY-NC-SA share-alike question) has been removed
  entirely, as has the brief use of PoB-generated tables: the single source of truth for all
  data is now the GGG patch server.
- **GGG fan content policy** applies on top of everything: this stays compliant by being
  non-commercial, attributing GGG, and not implying any official affiliation.
