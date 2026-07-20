# Architecture: GGPK to planner

Short map of how game data gets from GGG's own game files into the planner UI.
Full data-source audit: [`docs-internal/GGPK_SOURCE_OF_TRUTH.md`](docs-internal/GGPK_SOURCE_OF_TRUTH.md).
Release/promotion mechanics: see the `game-data-release-pipeline` note if you have it,
otherwise `.github/workflows/data-contract.yml`.

```
GGPK / patch server
        |
tools/poe-data-extract  (pathofexile-dat, patch given via PATCH env or live GGG query)
        |
        |  extract.mjs, build-data.mjs, transform.mjs, mod-catalogue.mjs
        |  build-data.mjs runs items/gems/runes/mods on worker_threads (extract-worker.mjs)
        |  npm: @poe2-toolkit/tree-extractor (passive tree + sprite atlases)
        v
resources/poe2/ggpk/*.json  (gems, items, runes, gem_requirements)
public/tree/current/data.json + assets/*.json/*.webp
public/icons/poe2/**
        |
        v
tests/Contract/GameDataContractTest.php  (Pest "Contract" suite)
        |  runs against REAL extracted data, no Storage mock
        |  asserts non-empty structure + every referenced icon exists on disk
        |  gate that promotes a staged extraction to "current" (CI: data-contract.yml)
        v
App\Tree\TreeIndex / CachedTreeIndex   -----   App\Pob\IconResolver
        |  parses data.json into the         |  resolves gem/item/rune name -> icon,
        |  tree topology + node lookups      |  tooltip text, stat descriptions
        v                                     v
        Laravel controllers (Inertia props)
        |
        v
resources/js  (React/Inertia)
        |  passive-tree/*  renders the tree, nodeTooltip.tsx
        |  planner/*       PlanSchema/PlanTabs/PlanItemSchema, ReferenceTooltip.tsx
        |  lib/planReferences.ts  shapes gem/item/rune refs the planner UI consumes
        v
   User's build plan (PoB import, tree allocation, item/gem picks)
```

## Stages

1. **Extraction** (`tools/poe-data-extract`). Only legitimate non-GGPK input: unique
   item mods, vendored from `PathOfBuilding-PoE2` Lua data (see the repo root's
   contributor guide, BLOCKER A, for why and its licensing terms). Everything else -
   tree, gems, items, runes, stat
   descriptions, icons - comes from the patch CDN via `pathofexile-dat`.
2. **Staging**. A fresh extraction is written to a staging path, not directly to
   `current`. Nothing downstream reads staged data until it passes the contract suite.
3. **Contract test gate** (`tests/Contract/GameDataContractTest.php`). Verifies the
   staged data is structurally sound and that every icon path it references actually
   exists on disk before the release is promoted (symlink swap to `current`). This is
   what stops a half-propagated patch CDN response from silently shipping broken data.
4. **Backend mapping**. `App\Tree\TreeIndex` turns `data.json` into node/class lookups
   used by the tree controller and by tree-side reference resolution (e.g.
   `NotableTreeMap`, `LeagueReference`). `App\Pob\IconResolver` maps gem/item/rune
   names from a PoB import (or picker UI) to their GGPK-sourced icon, tooltip and
   scaling data.
5. **Planner mapping**. `resources/js/lib/planReferences.ts` defines the shape the
   frontend consumes (`PlanReference`); `resources/js/components/planner/*` and
   `resources/js/components/build/tooltip.tsx` render it - same `TooltipCard` used by
   both the passive tree's node tooltips and the planner's gem/item/rune tooltips, so
   the two stay visually identical because they share one component, not by
   convention.

## Why this shape

The contract suite is the only thing standing between "GGPK extraction succeeded" and
"frontend has correct data" - it exists because the extractor can partially fail
(missing icon, empty table) without raising, and a promoted-but-broken release would
otherwise only surface as a blank tooltip or missing sprite in production.
