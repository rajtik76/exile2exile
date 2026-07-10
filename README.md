# Exile to Exile

*A free, open-source companion for Path of Exile 2 builds.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Live:** https://poe.rajtik.com

Import your Path of Exile 2 character, point it at a build you're following, and
get a concrete **diff** - what's missing or different across your passive tree,
your skill gems and supports, and your equipped item mods. No more checking a
guide act by act to see whether you picked the wrong support gem or skipped a
passive.

There isn't a dedicated tool for this in the PoE2 ecosystem yet, and that diff
layer is the whole point. It's a fan project: free, no ads, no monetization.

## Features

Working today:

- **Passive tree** - a full interactive PoE2 tree with allocation and shareable links.
- **Build planner** - plan a build, save it, share it.
- **Loot-filter generator** - custom in-game filters built on NeverSink, with
  highlights tuned to live market prices and your build.
- **Build import** - load a build from a Path of Building code.
- **Patch notifications** - subscribe to hear when a new PoE2 patch drops.

On the roadmap:

- **Character &harr; guide diff** - the headline feature: pull your live character
  through the GGG account API and compare it against a target build from Maxroll,
  Mobalytics, poe.ninja or pobb.in.

## Tech stack

- **Backend:** Laravel 13, PHP 8.4
- **Frontend:** Inertia v3, React 19, Tailwind v4, shadcn/ui
- **Tests:** Pest 4
- Built on Laravel's React starter kit.

## Game data

All PoE2 game data - passive tree, gems, items, mods and icons - is extracted
straight from the official GGPK / patch server by
[poe2-toolkit](https://github.com/rajtik76/poe2-toolkit) - my own open-source (MIT)
`@poe2-toolkit/*` npm packages for framework-agnostic GGPK extraction - driven from the pipeline in
[`tools/poe-data-extract`](tools/poe-data-extract). No third-party data dumps or
scrapes. Market prices come from [poe2scout](https://poe2scout.com). The loot
filter builds on [NeverSink's filter](https://github.com/NeverSinkDev/NeverSink-Filter).

## Local development

Requires PHP 8.4, Composer and Node 22.

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
composer run dev   # Vite + PHP server + queue worker, together
```

Then open the URL the dev command prints.

## Development notes

I'm a Laravel / PHP developer, so this is built on Laravel's React starter kit. I
chose React to learn it - I'm comfortable with Vue and wanted the practice. The
PHP backend I wrote and reviewed by hand; the React frontend was built largely
with AI assistance. Bug reports and issues are welcome - I maintain this and can
support it.

## License

The code is released under the MIT License (see [`LICENSE`](LICENSE)). The bundled
NeverSink filters are MIT (`resources/neversink/LICENSE`).

Path of Exile 2 game data, text and art are &copy; Grinding Gear Games, used here
under GGG's fan-content policy for a free, non-commercial community tool with no
official affiliation. Full source breakdown:
[`resources/poe2/ATTRIBUTION.md`](resources/poe2/ATTRIBUTION.md).
