# Exile to Exile

> Free, fan-made Path of Exile 2 tools - one player to another. Plan a build across the campaign, lay out the passive skill tree, generate an economy-aware loot filter, and subscribe to a patch-release webhook. Every piece of game data is sourced from Grinding Gear Games' official GGPK / patch server, never third-party scrapes.

Exile to Exile is an unofficial community project. It is not affiliated with, endorsed by, or sponsored by Grinding Gear Games. "Path of Exile 2" and all game content are trademarks of Grinding Gear Games, used here for identification only.

## Tools

- [Build planner]({{ route('planner.create') }}): plan a Path of Exile 2 build across campaign phases - gear, skill gems, passive tree and notes - import a Path of Building 2 code, generate a matching loot filter, and share a read-only link.
- [Passive tree planner]({{ route('tree') }}): plan a Path of Exile 2 passive skill tree - click to allocate, switch class and ascendancy, search nodes, and import a Path of Building 2 code.

## Developers

- [PoE2 patch webhook]({{ route('patch-webhook') }}): subscribe a URL and receive an HMAC-signed POST the moment a new Path of Exile 2 client version is detected on GGG's patch server (polled every five minutes). No account, no polling on your side.
- [@@poe2-toolkit on GitHub](https://github.com/rajtik76/poe2-toolkit): the open-source packages that power the tree - GGPK extraction, a headless geometry engine, and a WebGL renderer.

## About

- [Changelog]({{ route('changelog') }}): notable changes, newest first.
- [Credits and licenses]({{ route('credits') }})
- [Privacy policy]({{ route('privacy') }})
- [Terms of service]({{ route('terms') }})
