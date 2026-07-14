<?php

declare(strict_types=1);

use App\Pob\IconResolver;
use App\Pob\Uniques\PobUniqueStore;
use Illuminate\Support\Facades\File;

/**
 * IconResolver::uniqueReference() joins a unique's GGPK identity (icon, category,
 * flavour) with its mods synced separately from Path of Building - the one documented
 * exception to the GGPK-only rule, since unique mods aren't in GGG's own data files
 * (see resources/pob-uniques). These tests drive that join in isolation from the sync
 * command itself.
 */
beforeEach(function () {
    fakeGameData(
        files: [
            'resources/poe2/ggpk/items.json' => [
                'Constricting Command' => ['icon' => 'Uniques/ConstrictingCommand.dds', 'rarity' => 'unique', 'category' => 'Helmet'],
                'The Anvil' => ['icon' => 'Uniques/TheAnvil.dds', 'rarity' => 'unique', 'category' => 'Amulet'],
            ],
        ],
        icons: ['Uniques/ConstrictingCommand.png', 'Uniques/TheAnvil.png'],
    );

    config(['poe.pob_uniques.storage_path' => storage_path('game-data-test/pob-uniques')]);
    File::deleteDirectory(storage_path('game-data-test'));
});

afterEach(function () {
    File::deleteDirectory(storage_path('game-data-test'));
});

test('a unique reference carries its synced explicit mods as one tooltip string', function () {
    app(PobUniqueStore::class)->write([
        'Constricting Command' => [
            'name' => 'Constricting Command',
            'base' => 'Viper Cap',
            'league' => 'Dawn of the Hunt',
            'implicitCount' => 0,
            'mods' => [
                '+(80-120) to maximum Life',
                '+(10-15) to all Attributes',
                '(8-12) Life Regeneration per second',
            ],
        ],
    ], 'repo@sha');

    $resolver = app(IconResolver::class);
    $reference = $resolver->resolveReference('unique', 'Constricting Command');

    expect($reference)->not->toBeNull()
        ->and($reference['tooltip'])->toBe("+(80-120) to maximum Life\n+(10-15) to all Attributes\n(8-12) Life Regeneration per second")
        ->and($reference['implicits'])->toBe([])
        // The rest of the reference still resolves straight from GGPK, untouched by the join.
        ->and($reference['icon'])->toBe('/icons/poe2/Uniques/ConstrictingCommand.png')
        ->and($reference['category'])->toBe('Unique Helmet');
});

test('implicitCount splits the leading mod lines into implicits, the rest into the tooltip', function () {
    app(PobUniqueStore::class)->write([
        'The Anvil' => [
            'name' => 'The Anvil',
            'base' => 'Bloodstone Amulet',
            'league' => null,
            'implicitCount' => 1,
            'mods' => [
                '+(30-40) to maximum Life',
                '10% reduced Movement Speed',
                '(25-50)% increased Armour',
            ],
        ],
    ], 'repo@sha');

    $reference = app(IconResolver::class)->resolveReference('unique', 'The Anvil');

    expect($reference['implicits'])->toBe(['+(30-40) to maximum Life'])
        ->and($reference['tooltip'])->toBe("10% reduced Movement Speed\n(25-50)% increased Armour");
});

test('a unique with no synced mods yet still resolves, just without a tooltip', function () {
    // No PobUniqueStore write at all - the store's current.json never existed.
    $reference = app(IconResolver::class)->resolveReference('unique', 'Constricting Command');

    expect($reference)->not->toBeNull()
        ->and($reference['tooltip'])->toBeNull()
        ->and($reference['implicits'])->toBe([])
        ->and($reference['icon'])->not->toBeNull();
});

test('a container-free IconResolver (no PobUniqueStore) degrades the same way', function () {
    // Even with a synced snapshot on disk, an IconResolver built without a PobUniqueStore
    // (e.g. the plain `new IconResolver` used elsewhere in tests/the import path) must not
    // blow up - it just skips the join, same as before this feature existed.
    app(PobUniqueStore::class)->write([
        'Constricting Command' => [
            'name' => 'Constricting Command',
            'base' => 'Viper Cap',
            'league' => null,
            'implicitCount' => 0,
            'mods' => ['+(80-120) to maximum Life'],
        ],
    ], 'repo@sha');

    $reference = (new IconResolver)->resolveReference('unique', 'Constricting Command');

    expect($reference)->not->toBeNull()
        ->and($reference['tooltip'])->toBeNull()
        ->and($reference['implicits'])->toBe([])
        ->and($reference['icon'])->not->toBeNull();
});
