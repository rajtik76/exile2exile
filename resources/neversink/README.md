# NeverSink filter (vendored)

This directory holds NeverSink's Indepth Loot Filter for Path of Exile 2, vendored
verbatim and used under the MIT License (see `LICENSE`, Copyright (c) 2026 NeverSink).

Source: https://github.com/NeverSinkDev/NeverSink-Filter-for-PoE2

## How it's used

The loot-filter generator treats an unmodified NeverSink filter as its base: with no
changes, the downloaded filter behaves exactly like NeverSink's. The app then edits only
_what to highlight_ on top of that base - driven by live poe2scout economy prices and the
player's build (equipment, passive tree, gems) - by prepending override blocks, so the
game's first-match-wins rule lets those decisions win while NeverSink's body is untouched.

The filter's design, colour themes (STYLE variants) and strictness levels are NeverSink's,
kept 1:1. The economy determination and build-aware highlighting are the app's own.

Do not hand-edit these files: they are dropped in verbatim so attribution stays exact and
updates are a clean re-vendor.
