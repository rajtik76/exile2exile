<?php

declare(strict_types=1);

use App\Pob\IconResolver;
use App\Tree\TreeIndex;
use Illuminate\Support\Facades\Storage;

/**
 * Runs against REAL extracted GGPK-derived data (no Storage mock). Guards the data
 * contract the app depends on - structure, non-emptiness and that referenced icons exist
 * on disk - so the passive tree and item/gem resolution actually work. CI downloads the
 * served or freshly staged release for this suite (see data-contract.yml).
 */
function gameData(string $path): array
{
    $raw = Storage::disk('game-data')->get($path);

    expect($raw)->not->toBeNull("missing extracted data file: {$path}");

    return json_decode((string) $raw, true);
}

it('publishes a passive tree with nodes and classes', function () {
    $data = gameData('public/tree/current/data.json');

    expect($data['nodes'] ?? [])->toBeArray()->not->toBeEmpty()
        ->and($data['classes'] ?? [])->toBeArray()->not->toBeEmpty();
});

it('publishes the skill atlas frame map with its sheet size', function () {
    $skills = gameData('public/tree/current/assets/skills.json');

    expect($skills['frames'] ?? [])->toBeArray()->not->toBeEmpty()
        ->and($skills['sheet']['w'] ?? 0)->toBeGreaterThan(0)
        ->and($skills['sheet']['h'] ?? 0)->toBeGreaterThan(0);
});

/**
 * The tree hub loads its centre art by naming convention, not through a manifest:
 * portrait-<class>.webp and ascendancy-<slug>.webp per data.json's classes, plus
 * the two ring sprites (see classPortrait.tsx and classCatalog.ts). The extractor
 * skips art it cannot fetch, so an extraction against a half-propagated patch CDN
 * can stage a release with these files silently missing - this test is the
 * promotion gate that catches exactly that.
 */
it('ships centre art for every class, every ascendancy and both hub ring sprites', function () {
    $data = gameData('public/tree/current/data.json');
    $disk = Storage::disk('game-data');

    // Filename slug matching the extractor (buildCentre.ts): lower, non-alnum to '-'.
    $slug = fn (string $name): string => trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower($name)), '-');

    $expected = ['ring-static', 'ring-active'];

    expect($data['classes'] ?? [])->toBeArray()->not->toBeEmpty();

    foreach ($data['classes'] as $class) {
        $expected[] = 'portrait-'.$slug($class['name']);

        // Every released class carries at least one ascendancy; an empty list here
        // means the loop below would silently check nothing for it.
        expect($class['ascendancies'] ?? [])->toBeArray()->not->toBeEmpty();

        foreach ($class['ascendancies'] as $ascendancy) {
            $expected[] = 'ascendancy-'.$slug($ascendancy['name']);
        }
    }

    foreach ($expected as $name) {
        $path = "public/tree/current/assets/centre/{$name}.webp";

        expect($disk->exists($path))->toBeTrue("missing centre art: {$path}")
            ->and($disk->size($path))->toBeGreaterThan(0, "empty centre art file: {$path}");
    }
});

it('builds the tree index from the real data', function () {
    $index = app(TreeIndex::class);

    expect($index->nodes())->not->toBeEmpty()
        ->and($index->classes())->not->toBeEmpty();
});

it('ships gem data whose first icon exists on disk', function () {
    $gems = gameData('resources/poe2/ggpk/gems.json');

    expect($gems)->not->toBeEmpty();

    // The extract must have written the icon file the data points at, or the resolver
    // would return null (webPathIfPresent's on-disk check).
    expect((new IconResolver)->gemIcon((string) array_key_first($gems)))
        ->toStartWith('/icons/poe2/')->toEndWith('.png');
});

it('ships item data whose first base icon exists on disk', function () {
    $items = gameData('resources/poe2/ggpk/items.json');

    expect($items)->not->toBeEmpty();
    expect((new IconResolver)->itemIcon((string) array_key_first($items)))
        ->toStartWith('/icons/poe2/')->toEndWith('.png');
});

/**
 * Fixed logical asset paths the frontend references as string literals (item
 * rarity/currency tooltip banners, the gem tooltip header, the passive tree's
 * normal/notable/keystone banners, the gem hover placeholder, and the
 * rune/soul-core socket art) - not looked up through any per-entity JSON, so
 * nothing else in this suite would catch one going missing from a release.
 *
 * @see resources/js/components/build/tooltip.tsx
 * @see resources/js/components/planner/ReferenceTooltip.tsx
 * @see resources/js/components/build/ItemDisplay.tsx
 * @see tools/poe-data-extract/build-data.mjs (TOOLTIP_HEADER_TEXTURES)
 * @see @poe2-toolkit/rune-extractor's buildSockets.js
 */
it('ships every fixed UI banner and socket asset the frontend hardcodes', function () {
    $frames = ['white', 'magic', 'rare', 'unique', 'currency', 'normal', 'notable', 'keystone'];
    $sides = ['left', 'middle', 'right'];

    $paths = [];

    foreach ($frames as $frame) {
        foreach ($sides as $side) {
            $paths[] = "ui/tooltip-header-{$frame}-{$side}.png";
        }
    }

    $paths[] = 'ui/tooltip-header-gem-title.png';
    $paths[] = 'ui/gem-hover-placeholder.png';
    $paths[] = 'ui/rune-socket.png';
    $paths[] = 'ui/soul-core-socket.png';
    $paths[] = 'ui/socket-empty.png';

    $disk = Storage::disk('game-data');

    foreach ($paths as $path) {
        expect($disk->exists("public/icons/poe2/{$path}"))
            ->toBeTrue("missing fixed UI asset: {$path}");
    }
});

/**
 * Every gem whose data claims a hoverImage must have the actual file on disk -
 * checked directly against the disk rather than through IconResolver::gemHoverImage,
 * since that method silently falls back to the generic placeholder when the specific
 * file is missing, which would mask exactly the regression this test exists to catch.
 *
 * `gems.json` stores the raw GGPK `.dds` path (decoding it is IconResolver::gems()'s
 * own job, via ddsToPng()); the extractor only ever writes the decoded `.png` to
 * disk, so the check below mirrors that same extension swap.
 */
it('ships every gem hoverImage path the data points at', function () {
    $gems = gameData('resources/poe2/ggpk/gems.json');
    $disk = Storage::disk('game-data');

    $withHoverImage = 0;

    foreach ($gems as $id => $gem) {
        $hoverImage = $gem['hoverImage'] ?? null;

        if ($hoverImage === null) {
            continue;
        }

        $withHoverImage++;
        $pngPath = str_ends_with((string) $hoverImage, '.dds')
            ? substr((string) $hoverImage, 0, -4).'.png'
            : $hoverImage;

        expect($disk->exists("public/icons/poe2/{$pngPath}"))
            ->toBeTrue("gem {$id} points at a hoverImage that does not exist on disk: {$pngPath}");
    }

    // Coverage is genuinely sparse (see IconResolver::gemHoverImage's own doc), but
    // some gems on the current patch do carry one - if this hits zero, the check
    // above is vacuous and the extractor likely stopped populating the field.
    expect($withHoverImage)->toBeGreaterThan(0);
});
