# Path of Building unique-item mods (vendored data source)

Unique item explicit mods (e.g. "+(80-120) to maximum Life" on Constricting Command)
do not exist in GGPK's .dat tables - the game composes them client-side at runtime,
not from data GGG ships in the patch. This is the one documented exception to the
project's GGPK-only data-source policy.

Source: https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2
(`src/Data/Uniques/*.lua`).

Two separate things apply here:

- **The `.lua` files themselves** (PoB's own transcription/format) are used under the
  MIT License (see `LICENSE`, Copyright (c) 2016 David Gowor / Path of Building
  Community).
- **The item data they contain** (unique names, base types, mod text) is Grinding Gear
  Games' game content, not PoB's - each file's own header says so (`-- Item data (c)
Grinding Gear Games`). Same terms as the rest of this app's game data: used for a
  free, non-commercial community tool, in line with GGG's fan content policy.

## How it's used

Only the unique-item mod lines are read out of PoB's `Data/Uniques/*.lua` files and
folded into this app's item catalogue. No other PoB data (bases, gems, the passive
tree, formulas) is sourced this way - everything else stays GGPK-only.
